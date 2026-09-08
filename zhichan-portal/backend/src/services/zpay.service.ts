import crypto from 'node:crypto'
import { env } from '../config/env'

export interface ZpayOrderResult {
  channel: 'alipay' | 'wechat'
  qrContent: string
  payUrl?: string
  tradeNo?: string
}

export interface ZpayNotifyResult {
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
 * zpay 签名：除 sign / sign_type 及空值参数外，按参数名 ASCII 升序拼接为
 * a=b&c=d 形式，再直接拼接商户密钥后做 MD5（见官方 Node demo：
 * sign = md5(待签名串 + key)，key 前不加 "&"）。
 */
export function buildZpaySign(params: Record<string, string>): string {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] != null && k !== 'sign' && k !== 'sign_type')
    .sort()
  const prestr = keys.map((k) => `${k}=${params[k]}`).join('&')
  return md5(prestr + env.zpayKey)
}

/**
 * zpay API 下单（POST form-data 到 /mapi.php），返回二维码内容。
 * 需要 Node.js 18+（内置 fetch / FormData）。订单号即本系统 Order id。
 */
export async function createZpayOrder(
  order: { id: string; amountCents: number; method: string },
  clientIp?: string,
): Promise<ZpayOrderResult> {
  if (!env.zpayApiUrl || !env.zpayPid || !env.zpayKey) {
    throw new Error('zpay 未配置，请在 backend/.env 填写 ZPAY_API_URL / ZPAY_PID / ZPAY_KEY')
  }
  if (!env.zpayNotifyUrl) {
    throw new Error('zpay 未配置回调地址，请在 backend/.env 填写 ZPAY_NOTIFY_URL')
  }

  const type = order.method === 'ALIPAY' ? 'alipay' : 'wxpay'
  const rawParams: Record<string, string> = {
    pid: env.zpayPid,
    type,
    out_trade_no: order.id,
    notify_url: env.zpayNotifyUrl,
    name: '知产桥人工咨询费',
    money: (order.amountCents / 100).toFixed(2),
    device: 'pc',
  }
  if (clientIp) {
    rawParams.clientip = clientIp
  }

  const sign = buildZpaySign(rawParams)
  const body = new FormData()
  for (const [k, v] of Object.entries({ ...rawParams, sign, sign_type: 'MD5' })) {
    body.append(k, v)
  }

  const apiUrl = `${env.zpayApiUrl.replace(/\/+$/, '')}/mapi.php`
  let response: Response
  try {
    response = await fetch(apiUrl, { method: 'POST', body, signal: AbortSignal.timeout(15_000) })
  } catch (e) {
    throw new Error(`zpay 网关连接失败：${e instanceof Error ? e.message : String(e)}`)
  }

  let respBody: unknown
  try {
    respBody = await response.json()
  } catch {
    throw new Error(`zpay 网关返回异常（HTTP ${response.status}），请检查 ZPAY_API_URL 是否正确`)
  }

  const data = isRecord(respBody) && isRecord(respBody.data) ? respBody.data : isRecord(respBody) ? respBody : {}
  const code = String(data.code ?? '')
  if (code !== '1') {
    const message = typeof data.msg === 'string' ? data.msg : '未知错误'
    throw new Error(`zpay 下单失败：${message}（code=${code}）`)
  }

  const qrcode = typeof data.qrcode === 'string' ? data.qrcode : ''
  const payUrl = typeof data.payurl === 'string' ? data.payurl : ''
  if (!qrcode && !payUrl) {
    throw new Error(`zpay 未返回支付二维码，网关返回：${JSON.stringify(respBody)}`)
  }

  return {
    channel: type === 'alipay' ? 'alipay' : 'wechat',
    qrContent: qrcode,
    payUrl: payUrl || undefined,
    tradeNo: typeof data.trade_no === 'string' ? data.trade_no : undefined,
  }
}

/** zpay 异步通知验签；trade_status 非 TRADE_SUCCESS 视为失败 */
export function verifyZpayNotify(params: Record<string, string>): ZpayNotifyResult {
  const sign = params.sign ?? ''
  if (!sign) {
    return { ok: false }
  }
  if (buildZpaySign(params).toLowerCase() !== sign.toLowerCase()) {
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
