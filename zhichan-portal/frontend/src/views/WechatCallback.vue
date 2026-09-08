<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : ''
  const error = typeof route.query.error === 'string' ? route.query.error : ''
  if (error || !token) {
    router.replace('/user/login')
    return
  }
  try {
    await auth.applyToken(token)
    router.replace('/user/home')
  } catch {
    router.replace('/user/login')
  }
})
</script>

<template>
  <div class="callback-page">
    <div class="callback-card">
      <p>微信登录中…</p>
    </div>
  </div>
</template>

<style scoped>
.callback-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e8f4fd;
}

.callback-card {
  padding: 40px 56px;
  background: #ffffff;
  border-radius: 16px;
  color: #6b7280;
  font-size: 15px;
}
</style>
