<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { resetPassword, sendResetCode } from '@/api/auth'
import AuthCard from '@/components/AuthCard.vue'

const router = useRouter()

const form = reactive({
  account: '',
  code: '',
  newPassword: '',
  confirmPassword: '',
})
const loading = ref(false)
const sending = ref(false)
const countdown = ref(0)
const error = ref('')
const notice = ref('')
const success = ref(false)
let timer: number | null = null

function validAccount(account: string): boolean {
  return /^1\d{10}$/.test(account) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)
}

async function handleSendCode(): Promise<void> {
  error.value = ''
  notice.value = ''
  const account = form.account.trim()
  if (!validAccount(account)) {
    error.value = '请输入正确的手机号或邮箱'
    return
  }
  if (countdown.value > 0) return

  sending.value = true
  try {
    const result = await sendResetCode(account)
    if (result.devCode) {
      // 测试模式：接口直接返回验证码，自动填入方便演示
      form.code = result.devCode
      notice.value = result.message
    } else {
      notice.value = '验证码已发送，请查收短信或邮件'
    }
    startCountdown()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '验证码发送失败，请稍后重试'
  } finally {
    sending.value = false
  }
}

function startCountdown(): void {
  countdown.value = 60
  timer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
  }, 1000)
}

async function submit(): Promise<void> {
  error.value = ''
  notice.value = ''
  const account = form.account.trim()
  if (!validAccount(account)) {
    error.value = '请输入正确的手机号或邮箱'
    return
  }
  if (!form.code.trim()) {
    error.value = '请输入验证码'
    return
  }
  if (form.newPassword.length < 6) {
    error.value = '新密码至少 6 位'
    return
  }
  if (form.newPassword !== form.confirmPassword) {
    error.value = '两次输入的新密码不一致'
    return
  }

  loading.value = true
  try {
    await resetPassword({
      account,
      code: form.code.trim(),
      newPassword: form.newPassword,
    })
    success.value = true
    setTimeout(() => {
      router.push('/user/login?reset=1')
    }, 1500)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '密码重置失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => {
  if (timer !== null) window.clearInterval(timer)
})
</script>

<template>
  <AuthCard
    title="重置密码"
    subtitle="通过手机或邮箱验证码重新设置登录密码"
    color="#1E40AF"
    soft="rgba(30, 64, 175, 0.08)"
    shadow="rgba(30, 64, 175, 0.18)"
  >
    <form class="auth-form" @submit.prevent="submit">
      <div class="field">
        <label for="resetAccount">账号（手机号或邮箱）</label>
        <input
          id="resetAccount"
          v-model="form.account"
          type="text"
          placeholder="请输入注册时使用的手机号或邮箱"
          autocomplete="username"
        />
      </div>
      <div class="field">
        <label for="resetCode">验证码</label>
        <div class="code-row">
          <input
            id="resetCode"
            v-model="form.code"
            type="text"
            maxlength="6"
            placeholder="6 位验证码"
            autocomplete="one-time-code"
          />
          <button
            type="button"
            class="code-btn"
            :disabled="sending || countdown > 0"
            @click="handleSendCode"
          >
            {{ countdown > 0 ? `${countdown}s 后重新获取` : sending ? '发送中…' : '获取验证码' }}
          </button>
        </div>
      </div>
      <div class="field">
        <label for="resetNewPwd">新密码</label>
        <input
          id="resetNewPwd"
          v-model="form.newPassword"
          type="password"
          placeholder="至少 6 位"
          autocomplete="new-password"
        />
      </div>
      <div class="field">
        <label for="resetConfirmPwd">确认新密码</label>
        <input
          id="resetConfirmPwd"
          v-model="form.confirmPassword"
          type="password"
          placeholder="再次输入新密码"
          autocomplete="new-password"
        />
      </div>
      <p v-if="error" class="form-error">{{ error }}</p>
      <p v-if="notice" class="form-notice">{{ notice }}</p>
      <p v-if="success" class="form-success">密码重置成功，请使用新密码登录…</p>
      <button type="submit" class="submit-btn" :disabled="loading">
        {{ loading ? '提交中…' : '重置密码' }}
      </button>
      <p class="hint hint-center">
        <router-link class="inline-link" to="/user/login">返回登录</router-link>
        <span class="dot">·</span>
        <router-link class="inline-link" to="/">返回门户首页</router-link>
      </p>
    </form>
  </AuthCard>
</template>

<style scoped>
.code-row {
  display: flex;
  gap: 8px;
}

.code-row input {
  flex: 1;
  min-width: 0;
}

.code-btn {
  flex-shrink: 0;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  background: var(--accent, #1e40af);
  color: #ffffff;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.code-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.form-success {
  margin: 0;
  color: #52c41a;
  font-size: 13px;
  text-align: left;
}

.form-notice {
  margin: 0;
  color: #2563eb;
  font-size: 13px;
  text-align: left;
}

.inline-link {
  color: var(--accent, #1e40af);
  text-decoration: none;
  font-size: 13px;
}

.inline-link:hover {
  text-decoration: underline;
}

.dot {
  margin: 0 6px;
  color: #c0c8d4;
}

.hint-center {
  text-align: center;
}
</style>
