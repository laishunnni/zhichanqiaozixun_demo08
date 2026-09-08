import { prisma } from '../lib/prisma'
import { env } from '../config/env'
import { sendSms } from './sms.service'
import { sendResetCodeEmail } from './notify.service'

const CODE_TTL_MINUTES = 10
const RESEND_INTERVAL_MS = 60_000

export type SendResetCodeResult =
  | { status: 'ok'; devCode?: string }
  | { status: 'rate_limited' }
  | { status: 'not_found' }

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * 为用户账号生成并发送密码重置验证码。
 * 账号不区分大小写；不存在时返回 not_found（接口层统一提示，避免暴露账号是否注册）。
 */
export async function sendPasswordResetCode(account: string): Promise<SendResetCodeResult> {
  const user = await prisma.user.findFirst({
    where: { OR: [{ loginId: account }, { email: account }, { phone: account }] },
  })
  if (!user) {
    return { status: 'not_found' }
  }

  const latest = await prisma.passwordResetCode.findFirst({
    where: { account: user.loginId },
    orderBy: { createdAt: 'desc' },
  })
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_INTERVAL_MS) {
    return { status: 'rate_limited' }
  }

  const code = generateCode()
  await prisma.passwordResetCode.create({
    data: {
      account: user.loginId,
      code,
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
    },
  })

  // 测试/演示模式：直接返回验证码，便于本地联调；上线前必须改为 real
  if (env.resetCodeMode === 'mock') {
    return { status: 'ok', devCode: code }
  }

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)
  const isPhone = /^1\d{10}$/.test(account)
  if (isEmail && env.smtpHost && env.smtpUser) {
    await sendResetCodeEmail(account, code)
  } else if (isPhone && env.smsResetTemplateCode) {
    await sendSms(account, env.smsResetTemplateCode, { code })
  } else {
    throw new Error(
      '验证码发送通道未配置：邮箱账号需在 backend/.env 填写 SMTP，手机账号需填写短信模板',
    )
  }

  return { status: 'ok' }
}
