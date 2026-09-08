import type { RequestHandler } from 'express'
import type { Role } from '@prisma/client'
import { authenticate } from './auth'

/**
 * 角色权限中间件：先认证 JWT，再校验角色是否匹配。
 * 已按分组挂载：/api/user → USER、/api/expert → EXPERT、/api/admin → ADMIN。
 */
export function requireRole(role: Role): RequestHandler {
  return (req, res, next) => {
    authenticate(req, res, () => {
      if (req.role !== role) {
        res.status(403).json({ message: `无权限访问，需要 ${role} 角色` })
        return
      }
      next()
    })
  }
}
