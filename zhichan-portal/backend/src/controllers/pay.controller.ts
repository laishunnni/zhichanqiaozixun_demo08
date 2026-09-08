import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { asyncHandler } from '../utils/asyncHandler'
import { tryAssignExpert } from '../services/matching'
import {
  createPayment,
  handlePaid,
  handleWechatNotify,
  verifyAlipayNotify,
} from '../services/payment.service'
import { verifyEpayNotify } from '../services/epay.service'
import { verifyZpayNotify } from '../services/zpay.service'

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId
  const caseId = req.params.caseId
  if (!userId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }

  const caseRecord = await prisma.case.findFirst({ where: { id: caseId, userId } })
  if (!caseRecord) {
    res.status(404).json({ message: '案件不存在' })
    return
  }
  if (caseRecord.status !== 'APPROVED') {
    res.status(400).json({ message: '案件尚未通过审核，无法支付' })
    return
  }

  const method = req.body?.method === 'ALIPAY' ? 'ALIPAY' : 'WECHAT'
  const order = await prisma.order.create({
    data: {
      caseId,
      amountCents: caseRecord.amountCents,
      method,
      status: 'PENDING',
    },
  })

  const payment = await createPayment(order, { clientIp: req.ip })
  res.status(201).json({
    order,
    amountYuan: (caseRecord.amountCents / 100).toFixed(2),
    payment,
  })
})

/**
 * 模拟微信/支付宝支付回调：
 * 真实环境由支付平台异步回调 /api/pay/callback 触达，这里由用户端点击“模拟支付”触发。
 */
export const mockPay = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId
  const caseId = req.params.caseId
  const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId : ''
  if (!userId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }
  if (!orderId) {
    res.status(400).json({ message: '缺少订单号' })
    return
  }

  const caseRecord = await prisma.case.findFirst({ where: { id: caseId, userId } })
  if (!caseRecord) {
    res.status(404).json({ message: '案件不存在' })
    return
  }
  if (
    caseRecord.status === 'PAID' ||
    caseRecord.status === 'MATCHING' ||
    caseRecord.status === 'READY_TO_CHAT' ||
    caseRecord.status === 'COMPLETED'
  ) {
    res.json({
      message: '该案件已支付',
      case: caseRecord,
      matched: caseRecord.status === 'READY_TO_CHAT' || caseRecord.status === 'COMPLETED',
    })
    return
  }
  if (caseRecord.status !== 'APPROVED') {
    res.status(400).json({ message: '案件尚未通过审核，无法支付' })
    return
  }

  const order = await prisma.order.findFirst({ where: { id: orderId, caseId } })
  if (!order) {
    res.status(404).json({ message: '订单不存在' })
    return
  }
  if (order.status === 'SUCCESS') {
    res.json({ message: '订单已支付', case: caseRecord, matched: false })
    return
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: 'SUCCESS', externalId: `MOCK-${Date.now()}`, paidAt: new Date() },
    }),
    prisma.case.update({
      where: { id: caseId },
      data: { status: 'PAID' },
    }),
  ])

  // 支付成功后立即尝试匹配专员
  const result = await tryAssignExpert(caseId)
  const updated = await prisma.case.findUnique({ where: { id: caseId } })

  res.json({ message: '支付成功', case: updated, matched: result.matched })
})

/** 支付宝异步通知回调（公开接口，签名验签后处理） */
export const alipayNotify = asyncHandler(async (req: Request, res: Response) => {
  const raw =
    typeof req.body === 'string'
      ? req.body
      : new URLSearchParams(req.body as Record<string, string>).toString()
  const { ok, orderId } = await verifyAlipayNotify(raw)
  if (!ok || !orderId) {
    res.status(400).send('failure')
    return
  }
  await handlePaid(orderId, 'ALIPAY')
  res.send('success')
})

/** 微信支付 v3 回调（公开接口，解密验签后处理） */
export const wechatNotify = asyncHandler(async (req: Request, res: Response) => {
  try {
    const outTradeNo = await handleWechatNotify(JSON.stringify(req.body))
    await handlePaid(outTradeNo, 'WECHAT')
    res.json({ code: 'SUCCESS', message: '成功' })
  } catch (e) {
    res.status(500).json({ code: 'FAIL', message: e instanceof Error ? e.message : 'failed' })
  }
})

/** 易支付异步通知回调（公开接口，MD5 验签 + 金额复核后处理） */
export const epayNotify = asyncHandler(async (req: Request, res: Response) => {
  const source: unknown = (req.body && typeof req.body === 'object' ? req.body : req.query) ?? {}
  const params: Record<string, string> = {}
  if (source && typeof source === 'object') {
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      if (typeof value === 'string') {
        params[key] = value
      }
    }
  }

  const result = verifyEpayNotify(params)
  if (!result.ok || !result.orderId) {
    res.status(400).send('fail')
    return
  }

  const order = await prisma.order.findUnique({ where: { id: result.orderId } })
  if (!order) {
    res.status(404).send('fail')
    return
  }

  // 金额复核，防止回调被伪造或金额被篡改
  const money = Number(result.amountYuan)
  if (!Number.isFinite(money) || Math.round(money * 100) !== order.amountCents) {
    res.status(400).send('fail')
    return
  }

  await handlePaid(order.id, result.tradeNo ? `EPAY:${result.tradeNo}` : 'EPAY')
  res.send('success')
})

/** zpay 异步通知回调（公开接口，MD5 验签 + 金额复核后处理） */
export const zpayNotify = asyncHandler(async (req: Request, res: Response) => {
  const source: unknown = (req.body && typeof req.body === 'object' ? req.body : req.query) ?? {}
  const params: Record<string, string> = {}
  if (source && typeof source === 'object') {
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      if (typeof value === 'string') {
        params[key] = value
      }
    }
  }

  const result = verifyZpayNotify(params)
  if (!result.ok || !result.orderId) {
    res.status(400).send('fail')
    return
  }

  const order = await prisma.order.findUnique({ where: { id: result.orderId } })
  if (!order) {
    res.status(404).send('fail')
    return
  }

  // 金额复核，防止回调被伪造或金额被篡改
  const money = Number(result.amountYuan)
  if (!Number.isFinite(money) || Math.round(money * 100) !== order.amountCents) {
    res.status(400).send('fail')
    return
  }

  await handlePaid(order.id, result.tradeNo ? `ZPAY:${result.tradeNo}` : 'ZPAY')
  res.send('success')
})
