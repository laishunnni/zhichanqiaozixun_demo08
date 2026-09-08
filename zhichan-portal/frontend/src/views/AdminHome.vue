<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

function logout(): void {
  auth.logout()
  router.push('/admin/login')
}
</script>

<template>
  <div class="role-page" style="background: #eff6ff">
    <router-link class="corner-home" to="/">← 返回门户首页</router-link>
    <div class="role-title" style="color: #3b82f6">⚙️ 平台管理端</div>
    <p class="role-subtitle">登录成功，平台管理功能开发中</p>
    <section class="role-info">
      <p>管理员编号：{{ auth.user?.loginId }}</p>
      <p>角色：{{ auth.user?.role }}</p>
    </section>
    <div class="role-actions">
      <button style="background: #dbeafe; color: #3b82f6" @click="logout">退出登录</button>
    </div>
  </div>
</template>
