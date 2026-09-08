import { request } from './http'

export type AuthRole = 'USER' | 'EXPERT' | 'ADMIN'

export interface AuthUser {
  id: string
  role: AuthRole
  loginId: string
  mustChangePassword: boolean
}

export interface LoginPayload {
  loginId: string
  password?: string
  mode: 'password' | 'expert' | 'admin'
}

export interface LoginResult {
  token: string
  user: AuthUser
}

export function login(payload: LoginPayload): Promise<LoginResult> {
  return request<LoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function register(payload: { account: string; password: string }): Promise<LoginResult> {
  return request<LoginResult>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export interface SendResetCodeResult {
  message: string
  /** 测试模式（RESET_CODE_MODE=mock）下接口直接返回验证码，便于联调 */
  devCode?: string
}

export function sendResetCode(account: string): Promise<SendResetCodeResult> {
  return request<SendResetCodeResult>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ account }),
  })
}

export function resetPassword(payload: {
  account: string
  code: string
  newPassword: string
}): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function changePassword(payload: {
  oldPassword: string
  newPassword: string
}): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/password', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function fetchMe(): Promise<{ user: AuthUser }> {
  return request<{ user: AuthUser }>('/auth/me')
}
