import nodemailer from 'nodemailer'
import { prisma } from '../lib/prisma'
import { env } from '../config/env'
import { sendSms } from './sms.service'

async function logNotification(entry: {
  caseId?: string | null
  channel: string
  target: string
  content: string
  status: string
  error?: string
}): Promise<void> {
  try {
    await prisma.notificationLog.create({
      data: {
        caseId: entry.caseId ?? null,
        channel: entry.channel,
        target: entry.target,
        content: entry.content,
        status: entry.status,
        error: entry.error,
      },
    })
  } catch {
    // 通知日志失败不影响主流程
  }
}

let transporter: nodemailer.Transporter | null = null

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: { user: env.smtpUser, pass: env.smtpPass },
    })
  }
  await transporter.sendMail({
    from: env.smtpFrom || env.smtpUser,
    to,
    subject,
    html,
  })
}

/**
 * 密码重置验证码邮件。
 * 未配置 SMTP 时抛出明确错误，避免静默失败。
 */
export async function sendResetCodeEmail(to: string, code: string): Promise<void> {
  if (!env.smtpHost || !env.smtpUser) {
    throw new Error('邮件服务未配置，请在 backend/.env 填写 SMTP 参数')
  }
  await sendEmail(
    to,
    '知产桥：密码重置验证码',
    `<p>您好：</p>
     <p>您正在重置知产桥账号的登录密码，本次验证码为：</p>
     <p style="font-size:22px;font-weight:bold;letter-spacing:4px;color:#1e40af">${code}</p>
     <p>验证码 10 分钟内有效，请勿泄露给他人。若并非本人操作，请忽略本邮件。</p>`,
  )
}

/**
 * 案件匹配成功通知：短信 + 邮件（按用户留下的联系方式发送）。
 * 未配置对应通道时静默跳过并在 notification_logs 留痕。
 */
export async function notifyMatched(caseId: string): Promise<void> {
  const caseRecord = await prisma.case.findUnique({ where: { id: caseId } })
  if (!caseRecord) return

  const content = `您的案件 ${caseId} 已匹配到咨询专员，专员已就绪，请登录平台开始沟通。`

  if (caseRecord.contactPhone && env.smsNotifyTemplateCode) {
    try {
      await sendSms(caseRecord.contactPhone, env.smsNotifyTemplateCode, { content })
      await logNotification({
        caseId,
        channel: 'SMS',
        target: caseRecord.contactPhone,
        content,
        status: 'SUCCESS',
      })
    } catch (e) {
      await logNotification({
        caseId,
        channel: 'SMS',
        target: caseRecord.contactPhone,
        content,
        status: 'FAILED',
        error: e instanceof Error ? e.message : 'sms failed',
      })
    }
  }

  if (caseRecord.contactEmail && env.smtpHost && env.smtpUser) {
    try {
      await sendEmail(
        caseRecord.contactEmail,
        '知产桥：案件已匹配成功',
        `<p>您好：</p><p>${content}</p>`,
      )
      await logNotification({
        caseId,
        channel: 'EMAIL',
        target: caseRecord.contactEmail,
        content,
        status: 'SUCCESS',
      })
    } catch (e) {
      await logNotification({
        caseId,
        channel: 'EMAIL',
        target: caseRecord.contactEmail,
        content,
        status: 'FAILED',
        error: e instanceof Error ? e.message : 'email failed',
      })
    }
  }
}
