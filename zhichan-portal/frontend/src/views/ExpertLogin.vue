<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AuthCard from '@/components/AuthCard.vue'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ loginId: '', password: '' })
const loading = ref(false)
const error = ref('')

async function submit(): Promise<void> {
  error.value = ''
  if (!form.loginId.trim() || !form.password) {
    error.value = '请输入专员编号和密码'
    return
  }

  loading.value = true
  try {
    const result = await auth.login({
      loginId: form.loginId.trim(),
      password: form.password,
      mode: 'expert',
    })
    if (result.user.mustChangePassword) {
      await router.push('/expert/change-password')
    } else {
      await router.push('/expert/home')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthCard
    title="咨询专员端登录"
    subtitle="请使用值班人员目录中的编号与密码登录"
    color="#2563EB"
    soft="rgba(37, 99, 235, 0.08)"
    shadow="rgba(37, 99, 235, 0.18)"
  >
    <form class="auth-form" @submit.prevent="submit">
      <div class="field">
        <label for="loginId">专员编号</label>
        <input
          id="loginId"
          v-model="form.loginId"
          type="text"
          placeholder="如 ZX20260001"
          autocomplete="username"
        />
      </div>
      <div class="field">
        <label for="password">密码</label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          placeholder="请输入密码"
          autocomplete="current-password"
        />
      </div>
      <p class="hint">账号与密码以《咨询值班人员目录-密码》为准，不在名单内无法登录</p>
      <p v-if="error" class="form-error">{{ error }}</p>
      <button type="submit" class="submit-btn" :disabled="loading">
        {{ loading ? '登录中…' : '登 录' }}
      </button>
    </form>
    <router-link class="back-home" to="/">← 返回门户首页</router-link>
  </AuthCard>
</template>
