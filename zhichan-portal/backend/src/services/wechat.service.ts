import { env } from '../config/env'

/**
 * 微信登录：
 * - qrcode：微信开放平台网站应用扫码登录
 * - mp：微信公众号网页授权登录
 */
export function getWechatAuthorizeUrl(state: string): string {
  const redirect = encodeURIComponent(env.wechatRedirectUri)
  if (env.wechatLoginType === 'mp') {
    return (
      `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${env.wechatAppId}` +
      `&redirect_uri=${redirect}&response_type=code&scope=snsapi_userinfo&state=${state}#wechat_redirect`
    )
  }
  return (
    `https://open.weixin.qq.com/connect/qrconnect?appid=${env.wechatAppId}` +
    `&redirect_uri=${redirect}&response_type=code&scope=snsapi_login&state=${state}`
  )
}

export async function getWechatOpenid(code: string): Promise<string> {
  const url =
    `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${env.wechatAppId}` +
    `&secret=${env.wechatAppSecret}&code=${encodeURIComponent(code)}&grant_type=authorization_code`
  const res = await fetch(url)
  const data = (await res.json()) as { openid?: string; errcode?: number; errmsg?: string }
  if (!data.openid) {
    throw new Error(`微信授权失败：${data.errcode ?? 'unknown'} ${data.errmsg ?? ''}`)
  }
  return data.openid
}
