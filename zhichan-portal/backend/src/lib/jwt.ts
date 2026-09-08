import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'
import { env } from '../config/env'

export interface TokenData {
  userId: string
  role: Role
  loginId: string
}

interface JwtPayload extends TokenData {
  sub: string
}

export function signToken(data: TokenData): string {
  const payload: JwtPayload = {
    sub: data.userId,
    role: data.role,
    loginId: data.loginId,
  }
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  })
}

export function verifyToken(token: string): TokenData | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload
    return {
      userId: payload.sub,
      role: payload.role,
      loginId: payload.loginId,
    }
  } catch {
    return null
  }
}
