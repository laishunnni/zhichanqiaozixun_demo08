<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { changePassword } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import AuthCard from '@/components/AuthCard.vue'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    color?: string
    soft?: string
    shadow?: string
    redirectTo?: string
    oldPasswordPlaceholder?: string
  }>(),
  {
    title: '修改密码',
    subtitle: '输入当前密码后设置新密码',
    color: '#2563eb',
    soft: 'rgba(37, 99, 235, 0.08)',
    shadow: 'rgba(37, 99, 235, 0.18)',
    redirectTo: '/expert/login',
    oldPasswordPlaceholder: '请输入当前密码',
  },
)

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const loading = ref(false)
const error = ref('')
const success = ref(false)

async function submit(): Promise<void> {
  error.value = ''
  if (!form.oldPassword || !form.newPassword) {
    error.value = '请填写当前密码和新密码'
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
    await changePassword({
      oldPassword: form.oldPassword,
      newPassword: form.newPassword,
    })
    success.value = true
    auth.logout()
    setTimeout(() => {
      router.push(props.redirectTo)
    }, 1200)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '修改密码失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthCard
    :title="title"
    :subtitle="subtitle"
    :color="color"
    :soft="soft"
    :shadow="shadow"
  >
    <form class="auth-form" @submit.prevent="submit">
      <div class="field">
        <label for="oldPassword">当前密码</label>
        <input
          id="oldPassword"
          v-model="form.oldPassword"
          type="password"
          :placeholder="oldPasswordPlaceholder"
          autocomplete="current-password"
        />
      </div>
      <div class="field">
        <label for="newPassword">新密码</label>
        <input
          id="newPassword"
          v-model="form.newPassword"
          type="password"
          placeholder="至少 6 位"
          autocomplete="new-password"
        />
      </div>
      <div class="field">
        <label for="confirmPassword">确认新密码</label>
        <input
          id="confirmPassword"
          v-model="form.confirmPassword"
          type="password"
          placeholder="再次输入新密码"
          autocomplete="new-password"
        />
      </div>
      <p v-if="error" class="form-error">{{ error }}</p>
      <p v-if="success" class="form-success">密码修改成功，请使用新密码重新登录…</p>
      <button type="submit" class="submit-btn" :disabled="loading">
        {{ loading ? '提交中…' : '确认修改' }}
      </button>
    </form>
    <router-link class="back-home" to="/">← 返回门户首页</router-link>
  </AuthCard>
</template>

<style scoped>
.form-success {
  margin: 0;
  color: #52c41a;
  font-size: 13px;
  text-align: left;
}
</style>
