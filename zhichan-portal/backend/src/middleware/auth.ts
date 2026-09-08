import type { NextFunction, Request, Response } from 'express'
import type { Role } from '@prisma/client'
import { verifyToken } from '../lib/jwt'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      role?: Role
      loginId?: string
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: '未登录或 token 缺失' })
    return
  }

  const data = verifyToken(header.slice(7))
  if (!data) {
    res.status(401).json({ message: 'token 无效或已过期' })
    return
  }

  req.userId = data.userId
  req.role = data.role
  req.loginId = data.loginId
  next()
}
