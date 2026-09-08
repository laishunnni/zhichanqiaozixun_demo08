import crypto from 'node:crypto'
import fs from 'node:fs'
import AlipaySdk from 'alipay-sdk'
import { WxPay } from 'wechatpay-node-v3'
import { prisma } from '../lib/prisma'
import { env } from '../config/env'
import { tryAssignExpert } from './matching'
import { createEpayOrder } from './epay.service'
import { createZpayOrder } from './zpay.service'

export interface PaymentParams {
  mode: 'mock' | 'qrcode' | 'redirect'
  channel?: 'alipay' | 'wechat'
  qrContent?: string
  redirectUrl?: string
  message?: string
}

function readKey(value: string): Buffer {
  // 支持直接填密钥内容，或填写 pem 文件路径
  if (value.includes('-----BEGIN')) {
    return Buffer.from(value)
  }
  return fs.readFileSync(value)
}

export async function createPayment(
  order: { id: string; amountCents: number; method: string },
  meta?: { clientIp?: string },
): Promise<PaymentParams> {
  const provider = env.paymentProvider
  if (provider === 'alipay') {
    return createAlipayPayment(order)
  }
  if (provider === 'wechat') {
    return createWechatPayment(order)
  }
  if (provider === 'epay') {
    return createEpayPayment(order)
  }
  if (provider === 'zpay') {
    return createZpayPayment(order, meta?.clientIp)
  }
  return { mode: 'mock', message: '模拟支付' }
}

async function createEpayPayment(order: {
  id: string
  amountCents: number
  method: string
}): Promise<PaymentParams> {
  const epay = await createEpayOrder(order)
  if (epay.qrContent) {
    return { mode: 'qrcode', channel: epay.channel, qrContent: epay.qrContent }
  }
  if (epay.payUrl) {
    return { mode: 'redirect', channel: epay.channel, redirectUrl: epay.payUrl }
  }
  throw new Error('支付通道未返回二维码或收银台地址')
}

async function createZpayPayment(
  order: { id: string; amountCents: number; method: string },
  clientIp?: string,
): Promise<PaymentParams> {
  const zpay = await createZpayOrder(order, clientIp)
  if (zpay.qrContent) {
    return { mode: 'qrcode', channel: zpay.channel, qrContent: zpay.qrContent }
  }
  if (zpay.payUrl) {
    return { mode: 'redirect', channel: zpay.channel, redirectUrl: zpay.payUrl }
  }
  throw new Error('支付通道未返回二维码或收银台地址')
}

async function createAlipayPayment(order: {
  id: string
  amountCents: number
}): Promise<PaymentParams> {
  if (!env.alipayAppId || !env.alipayPrivateKey || !env.alipayPublicKey) {
    throw new Error('支付宝未配置，请在 backend/.env 填写 ALIPAY_* 参数')
  }
  const sdk = new AlipaySdk({
    appId: env.alipayAppId,
    privateKey: env.alipayPrivateKey,
    alipayPublicKey: env.alipayPublicKey,
    gateway: env.alipayGateway,
  })

  // 支付宝当面付（扫码支付）：返回二维码内容
  const result = await sdk.execute('alipay.trade.precreate', {
    notifyUrl: env.alipayNotifyUrl,
    bizContent: {
      out_trade_no: order.id,
      total_amount: (order.amountCents / 100).toFixed(2),
      subject: '知产桥人工咨询费',
    },
  })
  const qrCode = (result as { qr_code?: string })?.qr_code
  if (!qrCode) {
    throw new Error(`支付宝预下单失败：${JSON.stringify(result)}`)
  }
  return { mode: 'qrcode', channel: 'alipay', qrContent: qrCode }
}

async function createWechatPayment(order: {
  id: string
  amountCents: number
}): Promise<PaymentParams> {
  if (
    !env.wechatPayAppId ||
    !env.wechatPayMchId ||
    !env.wechatPaySerialNo ||
    !env.wechatPayPrivateKey ||
    !env.wechatPayApiV3Key
  ) {
    throw new Error('微信支付未配置，请在 backend/.env 填写 WECHAT_PAY_* 参数')
  }

  // wechatpay-node-v3 具体构造参数以安装版本文档为准，部署时需按商家证书联调
  const pay = new WxPay({
    appid: env.wechatPayAppId,
    mchid: env.wechatPayMchId,
    publicKey: readKey(env.wechatPayPublicKey),
    privateKey: readKey(env.wechatPayPrivateKey),
  })

  // 微信 Native 扫码支付：返回 code_url 二维码内容
  const result = await pay.transactions_native({
    description: '知产桥人工咨询费',
    out_trade_no: order.id,
    notify_url: env.wechatPayNotifyUrl,
    amount: { total: order.amountCents },
  })
  const codeUrl = (result as { code_url?: string })?.code_url
  if (!codeUrl) {
    throw new Error(`微信下单失败：${JSON.stringify(result)}`)
  }
  return { mode: 'qrcode', channel: 'wechat', qrContent: codeUrl }
}

/** 支付宝异步通知验签，返回订单号 */
export async function verifyAlipayNotify(
  rawBody: string,
): Promise<{ ok: boolean; orderId?: string }> {
  const sdk = new AlipaySdk({
    appId: env.alipayAppId,
    privateKey: env.alipayPrivateKey,
    alipayPublicKey: env.alipayPublicKey,
    gateway: env.alipayGateway,
  })
  const ok = sdk.checkNotifySign(rawBody)
  const orderId = new URLSearchParams(rawBody).get('out_trade_no') ?? undefined
  return { ok, orderId }
}

/** 微信支付 v3 回调：AES-256-GCM 解密 resource，返回订单号（生产环境建议同时校验 Wechatpay-Signature） */
export async function handleWechatNotify(rawBody: string): Promise<string> {
  const body = JSON.parse(rawBody) as { resource?: { ciphertext?: string; nonce?: string; associated_data?: string } }
  const resource = body?.resource
  if (!resource?.ciphertext || !resource.nonce) {
    throw new Error('微信回调缺少 resource')
  }
  const buf = Buffer.from(resource.ciphertext, 'base64')
  const tag = buf.subarray(buf.length - 16)
  const data = buf.subarray(0, buf.length - 16)
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(env.wechatPayApiV3Key, 'utf8'),
    Buffer.from(resource.nonce, 'utf8'),
  )
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  const parsed = JSON.parse(decrypted) as { out_trade_no?: string }
  if (!parsed.out_trade_no) {
    throw new Error('微信回调解密结果缺少 out_trade_no')
  }
  return parsed.out_trade_no
}

/** 支付成功统一处理：订单置为成功、案件置为已支付、触发匹配 */
export async function handlePaid(orderId: string, externalId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order || order.status === 'SUCCESS') return
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: 'SUCCESS', externalId, paidAt: new Date() },
    }),
    prisma.case.update({
      where: { id: order.caseId },
      data: { status: 'PAID' },
    }),
  ])
  await tryAssignExpert(order.caseId)
}
