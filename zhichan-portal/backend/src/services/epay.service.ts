import crypto from 'node:crypto'
import { env } from '../config/env'

export interface EpayOrderResult {
  channel: 'alipay' | 'wechat'
  qrContent: string
  payUrl?: string
  tradeNo?: string
}

export interface EpayNotifyResult {
  ok: boolean
  orderId?: string
  tradeNo?: string
  amountYuan?: string
}

function md5(value: string): string {
  return crypto.createHash('md5').update(value, 'utf8').digest('hex')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * 易支付签名：除 sign / sign_type / key 之外的参数按 key 升序拼接，
 * 末尾追加 &key=商户密钥 后做 MD5（彩虹易支付兼容写法）。
 * 签名规则若与你的易支付站点不同，只需改这一个函数。
 */
export function buildEpaySign(params: Record<string, string>): string {
  const keys = Object.keys(params)
    .filter(
      (k) =>
        params[k] !== '' &&
        params[k] != null &&
        k !== 'sign' &&
        k !== 'sign_type' &&
        k !== 'key',
    )
    .sort()
  const raw = keys.map((k) => `${k}=${params[k]}`).join('&')
  return md5(`${raw}&key=${env.epayKey}`)
}

/**
 * 易支付 API 下单（接口模式），返回可渲染的二维码内容。
 * 需要 Node.js 18+（使用内置 fetch）。订单号即本系统 Order id。
 */
export async function createEpayOrder(order: {
  id: string
  amountCents: number
  method: string
}): Promise<EpayOrderResult> {
  if (!env.epayApiUrl || !env.epayPid || !env.epayKey) {
    throw new Error('易支付未配置，请在 backend/.env 填写 EPAY_API_URL / EPAY_PID / EPAY_KEY')
  }
  if (!env.epayNotifyUrl) {
    throw new Error('易支付未配置回调地址，请在 backend/.env 填写 EPAY_NOTIFY_URL')
  }

  const type = order.method === 'ALIPAY' ? 'alipay' : 'wxpay'
  const params: Record<string, string> = {
    pid: env.epayPid,
    type,
    out_trade_no: order.id,
    notify_url: env.epayNotifyUrl,
    name: '知产桥人工咨询费',
    money: (order.amountCents / 100).toFixed(2),
  }
  if (env.epayReturnUrl) {
    params.return_url = env.epayReturnUrl
  }

  const sign = buildEpaySign(params)
  const query = new URLSearchParams({
    ...params,
    sign,
    sign_type: 'MD5',
    key: env.epayKey,
  }).toString()
  const apiUrl = `${env.epayApiUrl.replace(/\/+$/, '')}/api.php?act=order&${query}`

  let response: Response
  try {
    response = await fetch(apiUrl, { signal: AbortSignal.timeout(15_000) })
  } catch (e) {
    throw new Error(`易支付网关连接失败：${e instanceof Error ? e.message : String(e)}`)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error(`易支付网关返回异常（HTTP ${response.status}），请检查 EPAY_API_URL 是否正确`)
  }

  const data = isRecord(body) && isRecord(body.data) ? body.data : isRecord(body) ? body : {}
  const code = String(data.code ?? '')
  if (code !== '1' && code !== '200') {
    const message = typeof data.msg === 'string' ? data.msg : '未知错误'
    throw new Error(`易支付下单失败：${message}（code=${code}）`)
  }

  const qrContent = typeof data.qrcode === 'string' ? data.qrcode : ''
  const payUrl = typeof data.pay_url === 'string' ? data.pay_url : ''
  if (!qrContent && !payUrl) {
    throw new Error(`易支付未返回二维码，网关返回：${JSON.stringify(body)}`)
  }

  return {
    channel: type === 'alipay' ? 'alipay' : 'wechat',
    qrContent,
    payUrl: payUrl || undefined,
    tradeNo: typeof data.trade_no === 'string' ? data.trade_no : undefined,
  }
}

/** 易支付异步通知验签；trade_status 非 TRADE_SUCCESS 视为失败 */
export function verifyEpayNotify(params: Record<string, string>): EpayNotifyResult {
  const sign = params.sign ?? ''
  if (!sign) {
    return { ok: false }
  }
  if (buildEpaySign(params).toLowerCase() !== sign.toLowerCase()) {
    return { ok: false }
  }
  if (params.trade_status && params.trade_status !== 'TRADE_SUCCESS') {
    return { ok: false }
  }
  return {
    ok: true,
    orderId: params.out_trade_no,
    tradeNo: params.trade_no,
    amountYuan: params.money,
  }
}
