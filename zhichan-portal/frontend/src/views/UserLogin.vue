<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login, register } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import AuthCard from '@/components/AuthCard.vue'

type Tab = 'login' | 'register'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const tab = ref<Tab>('login')
const loading = ref(false)
const error = ref('')
const resetNotice = ref(route.query.reset === '1')

const loginForm = reactive({ account: '', password: '' })
const registerForm = reactive({ account: '', password: '', confirmPassword: '' })

function validAccount(account: string): boolean {
  return /^1\d{10}$/.test(account) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)
}

async function submitLogin(): Promise<void> {
  error.value = ''
  const account = loginForm.account.trim()
  if (!validAccount(account)) {
    error.value = '请输入正确的手机号或邮箱'
    return
  }
  if (!loginForm.password) {
    error.value = '请输入密码'
    return
  }

  loading.value = true
  try {
    await auth.login({ loginId: account, password: loginForm.password, mode: 'password' })
    await router.push('/user/home')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function submitRegister(): Promise<void> {
  error.value = ''
  const account = registerForm.account.trim()
  if (!validAccount(account)) {
    error.value = '请输入正确的手机号或邮箱'
    return
  }
  if (registerForm.password.length < 6) {
    error.value = '密码至少 6 位'
    return
  }
  if (registerForm.password !== registerForm.confirmPassword) {
    error.value = '两次输入的密码不一致'
    return
  }

  loading.value = true
  try {
    const result = await register({ account, password: registerForm.password })
    auth.token = result.token
    auth.user = result.user
    localStorage.setItem('zhichan_token', result.token)
    localStorage.setItem('zhichan_user', JSON.stringify(result.user))
    await router.push('/user/home')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '注册失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthCard
    title="用户端"
    subtitle="首次使用请注册并设置密码，之后凭账号 + 密码登录"
    color="#1E40AF"
    soft="rgba(30, 64, 175, 0.08)"
    shadow="rgba(30, 64, 175, 0.18)"
  >
    <div class="tabs">
      <button type="button" :class="['tab', { active: tab === 'login' }]" @click="tab = 'login'">
        登录
      </button>
      <button type="button" :class="['tab', { active: tab === 'register' }]" @click="tab = 'register'">
        首次注册
      </button>
    </div>

    <form v-if="tab === 'login'" class="auth-form" @submit.prevent="submitLogin">
      <div class="field">
        <label for="loginAccount">账号（手机号或邮箱）</label>
        <input
          id="loginAccount"
          v-model="loginForm.account"
          type="text"
          placeholder="请输入手机号或邮箱"
          autocomplete="username"
        />
      </div>
      <div class="field">
        <label for="loginPassword">密码</label>
        <input
          id="loginPassword"
          v-model="loginForm.password"
          type="password"
          placeholder="请输入密码"
          autocomplete="current-password"
        />
      </div>
      <div class="forgot-row">
        <router-link class="forgot-link" to="/user/forgot-password">忘记密码？</router-link>
      </div>
      <p v-if="resetNotice" class="reset-notice">密码已重置，请使用新密码登录</p>
      <p v-if="error" class="form-error">{{ error }}</p>
      <button type="submit" class="submit-btn" :disabled="loading">
        {{ loading ? '登录中…' : '登 录' }}
      </button>
      <p class="hint hint-center">未注册过？请切换到“首次注册”设置密码</p>
    </form>

    <form v-else class="auth-form" @submit.prevent="submitRegister">
      <div class="field">
        <label for="regAccount">账号（手机号或邮箱）</label>
        <input
          id="regAccount"
          v-model="registerForm.account"
          type="text"
          placeholder="请输入手机号或邮箱"
          autocomplete="username"
        />
      </div>
      <div class="field">
        <label for="regPassword">设置密码</label>
        <input
          id="regPassword"
          v-model="registerForm.password"
          type="password"
          placeholder="至少 6 位"
          autocomplete="new-password"
        />
      </div>
      <div class="field">
        <label for="regConfirm">确认密码</label>
        <input
          id="regConfirm"
          v-model="registerForm.confirmPassword"
          type="password"
          placeholder="再次输入密码"
          autocomplete="new-password"
        />
      </div>
      <p v-if="error" class="form-error">{{ error }}</p>
      <button type="submit" class="submit-btn" :disabled="loading">
        {{ loading ? '注册中…' : '注册并登录' }}
      </button>
      <p class="hint hint-center">注册成功后自动登录，下次直接使用账号 + 密码登录</p>
    </form>

    <router-link class="back-home" to="/">← 返回门户首页</router-link>
  </AuthCard>
</template>

<style scoped>
.tabs {
  display: flex;
  width: 100%;
  margin-top: 24px;
  padding: 4px;
  background: #f0f5fb;
  border-radius: 10px;
}

.tab {
  flex: 1;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #5b6470;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab.active {
  background: #ffffff;
  color: var(--accent, #1e40af);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(31, 35, 41, 0.08);
}

.hint-center {
  text-align: center;
}

.forgot-row {
  display: flex;
  justify-content: flex-end;
  margin-top: -2px;
}

.forgot-link {
  color: var(--accent, #1e40af);
  font-size: 13px;
  text-decoration: none;
}

.forgot-link:hover {
  text-decoration: underline;
}

.reset-notice {
  margin: 0;
  color: #52c41a;
  font-size: 13px;
  text-align: left;
}
</style>
