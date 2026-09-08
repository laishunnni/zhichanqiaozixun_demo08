import { defineStore } from 'pinia'
import {
  login as apiLogin,
  fetchMe,
  type AuthRole,
  type AuthUser,
  type LoginPayload,
} from '@/api/auth'

const TOKEN_KEY = 'zhichan_token'
const USER_KEY = 'zhichan_user'

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) ?? '',
    user: readStoredUser(),
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.token && state.user),
    role: (state) => state.user?.role ?? null,
  },

  actions: {
    async login(payload: LoginPayload) {
      const result = await apiLogin(payload)
      this.token = result.token
      this.user = result.user
      localStorage.setItem(TOKEN_KEY, result.token)
      localStorage.setItem(USER_KEY, JSON.stringify(result.user))
      return result
    },

    async refreshUser() {
      if (!this.token) return
      const { user } = await fetchMe()
      this.user = user
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    },

    async applyToken(token: string) {
      this.token = token
      localStorage.setItem(TOKEN_KEY, token)
      await this.refreshUser()
    },

    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    },
  },
})

export type { AuthRole }
