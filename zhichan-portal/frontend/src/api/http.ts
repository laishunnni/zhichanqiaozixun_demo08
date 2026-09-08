const API_BASE = '/api'
const TOKEN_KEY = 'zhichan_token'

interface ApiErrorBody {
  message?: string
  error?: string
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY)
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  }
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    let message = `请求失败（${res.status}）`
    try {
      const body = (await res.json()) as ApiErrorBody
      message = body.message ?? body.error ?? message
    } catch {
      // 响应体不是 JSON 时使用默认错误信息
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}
