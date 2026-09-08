import type { Request, Response } from 'express'
import type { Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { env } from '../config/env'
import { signToken } from '../lib/jwt'
import { comparePassword, hashPassword } from '../utils/password'
import { asyncHandler } from '../utils/asyncHandler'
import { getWechatAuthorizeUrl, getWechatOpenid } from '../services/wechat.service'
import { sendPasswordResetCode } from '../services/passwordReset.service'

const EXPERT_INITIAL_PASSWORD = '123456'

interface PublicUser {
  id: string
  role: Role
  loginId: string
  mustChangePassword: boolean
}

function toPublicUser(user: {
  id: string
  role: Role
  loginId: string
  mustChangePassword: boolean
}): PublicUser {
  return {
    id: user.id,
    role: user.role,
    loginId: user.loginId,
    mustChangePassword: user.mustChangePassword,
  }
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { loginId, password, mode } = req.body as {
    loginId?: unknown
    password?: unknown
    mode?: unknown
  }

  const rawLoginId = typeof loginId === 'string' ? loginId.trim() : ''
  if (!rawLoginId) {
    res.status(400).json({ message: '请输入登录账号' })
    return
  }

  const loginMode = typeof mode === 'string' ? mode : 'password'

  // 模式：账号/密码（USER）、专员编号/密码（EXPERT）、管理员编号/密码（ADMIN）
  const roleByMode: Partial<Record<string, Role>> = {
    password: 'USER',
    expert: 'EXPERT',
    admin: 'ADMIN',
  }
  const expectedRole = roleByMode[loginMode]
  if (!expectedRole) {
    res.status(400).json({ message: '不支持的登录方式' })
    return
  }

  const user = await prisma.user.findUnique({ where: { loginId: rawLoginId } })
  if (!user || user.role !== expectedRole) {
    res.status(401).json({ message: '账号或密码错误' })
    return
  }
  if (!user.isActive) {
    res.status(403).json({ message: '账号已被禁用' })
    return
  }

  const rawPassword = typeof password === 'string' ? password : ''
  const passwordOk = await comparePassword(rawPassword, user.passwordHash)
  if (!passwordOk) {
    res.status(401).json({ message: '账号或密码错误' })
    return
  }

  const mustChangePassword =
    user.mustChangePassword ||
    (expectedRole === 'EXPERT' && rawPassword === EXPERT_INITIAL_PASSWORD)

  const token = signToken({ userId: user.id, role: user.role, loginId: user.loginId })
  res.json({
    token,
    user: { ...toPublicUser(user), mustChangePassword },
  })
})

export const getWechatLoginUrl = asyncHandler(async (_req: Request, res: Response) => {
  if (!env.wechatAppId || !env.wechatAppSecret || !env.wechatRedirectUri) {
    res.status(500).json({ message: '微信登录未配置，请在 backend/.env 填写参数' })
    return
  }
  const state = `st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  res.json({ url: getWechatAuthorizeUrl(state) })
})

export const wechatCallback = asyncHandler(async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  if (!code) {
    res.redirect(`${env.frontendOrigin}/wechat/callback?error=missing_code`)
    return
  }

  let openid: string
  try {
    openid = await getWechatOpenid(code)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'wechat_failed'
    res.redirect(`${env.frontendOrigin}/wechat/callback?error=${encodeURIComponent(message)}`)
    return
  }

  let user = await prisma.user.findUnique({ where: { wechatOpenid: openid } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        role: 'USER',
        loginId: `wechat_${openid}`,
        wechatOpenid: openid,
        passwordHash: await hashPassword(Math.random().toString(36).slice(2)),
      },
    })
  }

  const token = signToken({ userId: user.id, role: user.role, loginId: user.loginId })
  res.redirect(`${env.frontendOrigin}/wechat/callback?token=${encodeURIComponent(token)}`)
})

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { account, password } = req.body as { account?: unknown; password?: unknown }
  const rawAccount = typeof account === 'string' ? account.trim().toLowerCase() : ''
  const rawPassword = typeof password === 'string' ? password : ''

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawAccount)
  const isPhone = /^1\d{10}$/.test(rawAccount)
  if (!isEmail && !isPhone) {
    res.status(400).json({ message: '请输入正确的手机号或邮箱' })
    return
  }
  if (rawPassword.length < 6) {
    res.status(400).json({ message: '密码至少 6 位' })
    return
  }

  const exists = await prisma.user.findFirst({
    where: {
      OR: [
        { loginId: rawAccount },
        { email: isEmail ? rawAccount : undefined },
        { phone: isPhone ? rawAccount : undefined },
      ],
    },
  })
  if (exists) {
    res.status(409).json({ message: '该账号已注册，请直接登录' })
    return
  }

  const user = await prisma.user.create({
    data: {
      role: 'USER',
      loginId: rawAccount,
      email: isEmail ? rawAccount : null,
      phone: isPhone ? rawAccount : null,
      passwordHash: await hashPassword(rawPassword),
    },
  })

  const token = signToken({ userId: user.id, role: user.role, loginId: user.loginId })
  res.status(201).json({ token, user: toPublicUser(user) })
})

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { account } = req.body as { account?: unknown }
  const rawAccount = typeof account === 'string' ? account.trim().toLowerCase() : ''
  if (!rawAccount) {
    res.status(400).json({ message: '请输入账号' })
    return
  }

  const result = await sendPasswordResetCode(rawAccount)
  if (result.status === 'rate_limited') {
    res.status(429).json({ message: '验证码发送过于频繁，请 60 秒后再试' })
    return
  }
  if (result.status === 'ok' && result.devCode) {
    res.json({ message: '测试模式：验证码已生成，请填写下方验证码完成重置', devCode: result.devCode })
    return
  }
  res.json({ message: '如果该账号已注册，验证码已发送' })
})

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { account, code, newPassword } = req.body as {
    account?: unknown
    code?: unknown
    newPassword?: unknown
  }
  const rawAccount = typeof account === 'string' ? account.trim().toLowerCase() : ''
  const rawCode = typeof code === 'string' ? code.trim() : ''
  const rawNewPassword = typeof newPassword === 'string' ? newPassword : ''

  if (!rawAccount || !rawCode) {
    res.status(400).json({ message: '请输入账号和验证码' })
    return
  }
  if (rawNewPassword.length < 6) {
    res.status(400).json({ message: '新密码至少 6 位' })
    return
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ loginId: rawAccount }, { email: rawAccount }, { phone: rawAccount }] },
  })
  if (!user) {
    res.status(400).json({ message: '验证码错误或已过期' })
    return
  }

  const record = await prisma.passwordResetCode.findFirst({
    where: {
      account: user.loginId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!record || record.code !== rawCode) {
    res.status(400).json({ message: '验证码错误或已过期' })
    return
  }

  const passwordHash = await hashPassword(rawNewPassword)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.passwordResetCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ])

  res.json({ message: '密码重置成功，请使用新密码登录' })
})

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ message: '未登录' })
    return
  }

  const { oldPassword, newPassword } = req.body as {
    oldPassword?: unknown
    newPassword?: unknown
  }
  const rawOld = typeof oldPassword === 'string' ? oldPassword : ''
  const rawNew = typeof newPassword === 'string' ? newPassword : ''

  if (!rawOld) {
    res.status(400).json({ message: '请输入当前密码' })
    return
  }
  if (rawNew.length < 6) {
    res.status(400).json({ message: '新密码至少 6 位' })
    return
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    res.status(401).json({ message: '用户不存在' })
    return
  }

  const ok = await comparePassword(rawOld, user.passwordHash)
  if (!ok) {
    res.status(400).json({ message: '当前密码不正确' })
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(rawNew),
      mustChangePassword: false,
    },
  })

  res.json({ message: '密码修改成功' })
})

export const me = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ message: '未登录' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      loginId: true,
      email: true,
      phone: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
    },
  })
  if (!user) {
    res.status(404).json({ message: '用户不存在' })
    return
  }

  res.json({ user })
})
