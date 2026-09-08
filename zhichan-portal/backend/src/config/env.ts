import 'dotenv/config'

export const env = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'zhichan-bridge-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  // 阿里云短信
  smsAccessKeyId: process.env.SMS_ACCESS_KEY_ID ?? '',
  smsAccessKeySecret: process.env.SMS_ACCESS_KEY_SECRET ?? '',
  smsSignName: process.env.SMS_SIGN_NAME ?? '',
  // 密码重置验证码：mock（默认，开发/演示直接返回验证码）| real（真实发送短信/邮件）
  resetCodeMode: process.env.RESET_CODE_MODE ?? 'mock',
  smsResetTemplateCode: process.env.SMS_RESET_TEMPLATE_CODE ?? '',
  // 微信登录（开放平台扫码 或 公众号网页授权）
  wechatAppId: process.env.WECHAT_APP_ID ?? '',
  wechatAppSecret: process.env.WECHAT_APP_SECRET ?? '',
  wechatRedirectUri: process.env.WECHAT_REDIRECT_URI ?? '',
  wechatLoginType: process.env.WECHAT_LOGIN_TYPE ?? 'qrcode',
  // 支付（mock 为默认模拟模式；alipay / wechat / epay / zpay 为真实通道）
  paymentProvider: process.env.PAYMENT_PROVIDER ?? 'mock',
  alipayAppId: process.env.ALIPAY_APP_ID ?? '',
  alipayPrivateKey: process.env.ALIPAY_PRIVATE_KEY ?? '',
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY ?? '',
  alipayNotifyUrl: process.env.ALIPAY_NOTIFY_URL ?? '',
  alipayGateway: process.env.ALIPAY_GATEWAY ?? 'https://openapi.alipay.com/gateway.do',
  wechatPayAppId: process.env.WECHAT_PAY_APP_ID ?? '',
  wechatPayMchId: process.env.WECHAT_PAY_MCH_ID ?? '',
  wechatPaySerialNo: process.env.WECHAT_PAY_SERIAL_NO ?? '',
  wechatPayPrivateKey: process.env.WECHAT_PAY_PRIVATE_KEY ?? '',
  wechatPayPublicKey: process.env.WECHAT_PAY_PUBLIC_KEY ?? '',
  wechatPayApiV3Key: process.env.WECHAT_PAY_API_V3_KEY ?? '',
  wechatPayNotifyUrl: process.env.WECHAT_PAY_NOTIFY_URL ?? '',
  // 易支付（第三方聚合支付：支付宝/微信扫码）
  epayApiUrl: process.env.EPAY_API_URL ?? '',
  epayPid: process.env.EPAY_PID ?? '',
  epayKey: process.env.EPAY_KEY ?? '',
  epayNotifyUrl: process.env.EPAY_NOTIFY_URL ?? '',
  epayReturnUrl: process.env.EPAY_RETURN_URL ?? '',
  // zpay 支付（第三方聚合支付：微信/支付宝扫码）
  zpayApiUrl: process.env.ZPAY_API_URL ?? '',
  zpayPid: process.env.ZPAY_PID ?? '',
  zpayKey: process.env.ZPAY_KEY ?? '',
  zpayNotifyUrl: process.env.ZPAY_NOTIFY_URL ?? '',
  // 通知（匹配成功短信/邮件）
  smsNotifyTemplateCode: process.env.SMS_NOTIFY_TEMPLATE_CODE ?? '',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 465),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? '',
  smtpSecure: process.env.SMTP_SECURE === 'true',
}
