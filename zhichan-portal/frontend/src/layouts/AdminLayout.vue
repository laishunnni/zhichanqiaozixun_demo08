<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppFooter from '@/components/AppFooter.vue'
import BrandLogo from '@/components/BrandLogo.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const navItems = [
  { path: '/admin/audit', label: '材料审核', icon: '📋' },
  { path: '/admin/schedule', label: '排班管理', icon: '🗓️' },
  { path: '/admin/records', label: '监控记录', icon: '🔍' },
  { path: '/admin/quality', label: '质量监管', icon: '🛡️' },
  { path: '/admin/dashboard', label: '数据看板', icon: '📊' },
  { path: '/admin/change-password', label: '修改密码', icon: '🔑' },
]

function logout(): void {
  auth.logout()
  router.push('/admin/login')
}
</script>

<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="admin-brand">
        <BrandLogo :size="36" />
        <span class="admin-brand-name">知产桥</span>
        <span class="admin-brand-tag">平台管理</span>
      </div>
      <nav class="admin-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="admin-nav-item"
          :class="{ active: route.path === item.path }"
        >
          <span class="admin-nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
      <button type="button" class="admin-logout" @click="logout">退出登录</button>
    </aside>

    <div class="admin-main">
      <router-view />
      <AppFooter />
    </div>
  </div>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
  display: flex;
  background: #e8f4fd;
}

.admin-sidebar {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 20px 14px;
  background: #ffffff;
  border-right: 1px solid rgba(59, 130, 246, 0.08);
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px 18px;
  border-bottom: 1px solid #f0f0f5;
}

.admin-brand-name {
  font-size: 20px;
  font-weight: 800;
  color: #3b82f6;
  letter-spacing: 2px;
}

.admin-brand-tag {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  font-size: 11px;
}

.admin-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 16px;
}

.admin-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  color: #4b5563;
  font-size: 14px;
  text-decoration: none;
  transition: all 0.2s ease;
}

.admin-nav-item:hover {
  background: rgba(59, 130, 246, 0.06);
}

.admin-nav-item.active {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
  font-weight: 600;
}

.admin-nav-icon {
  font-size: 16px;
}

.admin-logout {
  margin-top: 12px;
  padding: 10px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #f4f8ff;
  color: #3b82f6;
  font-size: 13px;
  cursor: pointer;
}

.admin-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 24px;
}

@media (max-width: 768px) {
  .admin-layout {
    flex-direction: column;
  }

  .admin-sidebar {
    width: 100%;
    flex-direction: row;
    align-items: center;
    padding: 10px 12px;
    border-right: none;
    border-bottom: 1px solid rgba(59, 130, 246, 0.08);
  }

  .admin-brand {
    border-bottom: none;
    padding: 0;
  }

  .admin-brand-tag {
    display: none;
  }

  .admin-nav {
    flex-direction: row;
    overflow-x: auto;
    padding-top: 0;
    padding-left: 12px;
  }

  .admin-nav-item {
    white-space: nowrap;
    padding: 8px 12px;
  }

  .admin-logout {
    margin-top: 0;
    margin-left: auto;
    padding: 8px 12px;
  }

  .admin-main {
    padding: 16px 12px;
  }
}
</style>
