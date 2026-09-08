<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listCases, type CaseDto, type CaseStatus } from '@/api/cases'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const cases = ref<CaseDto[]>([])
const loaded = ref(false)

const statusTextMap: Record<CaseStatus, string> = {
  PENDING_REVIEW: '审核中',
  APPROVED: '待支付',
  PAID: '已支付',
  MATCHING: '匹配中',
  READY_TO_CHAT: '沟通中',
  IN_COMMUNICATION: '沟通中',
  COMPLETED: '已完成',
  REJECTED: '未通过',
}

function caseLink(c: CaseDto): string {
  if (c.status === 'APPROVED') {
    return `/user/pay/${c.id}`
  }
  if (c.status === 'PENDING_REVIEW' || c.status === 'REJECTED') {
    return '/user/submit'
  }
  return `/user/chat/${c.id}`
}

async function loadCases(): Promise<void> {
  try {
    const { cases: list } = await listCases()
    cases.value = list
  } catch {
    // 列表加载失败不阻塞页面
  } finally {
    loaded.value = true
  }
}

function logout(): void {
  auth.logout()
  router.push('/user/login')
}

onMounted(loadCases)
</script>

<template>
  <div class="role-page" style="background: #e8f4fd">
    <router-link class="corner-home" to="/">← 返回门户首页</router-link>
    <div class="role-title" style="color: #1e40af">👤 用户端</div>
    <p class="role-subtitle">登录成功，欢迎使用知产桥</p>
    <section class="role-info">
      <p>登录账号：{{ auth.user?.loginId }}</p>
      <p>角色：{{ auth.user?.role }}</p>
    </section>
    <div class="role-actions">
      <button style="background: #1e40af; color: #fff" @click="router.push('/user/submit')">
        提交侵权材料
      </button>
      <button style="background: #ffffff; color: #1e40af" @click="router.push('/user/change-password')">
        修改密码
      </button>
      <button style="background: #ffffff; color: #f5222d" @click="logout">退出登录</button>
    </div>

    <section class="case-list">
      <h3>我的案件</h3>
      <p v-if="!loaded" class="case-empty">加载中…</p>
      <p v-else-if="cases.length === 0" class="case-empty">
        暂无案件，点击上方“提交侵权材料”开始
      </p>
      <div v-else class="case-items">
        <div v-for="c in cases" :key="c.id" class="case-item" @click="router.push(caseLink(c))">
          <div class="case-row">
            <span class="case-platforms">{{ c.platforms.join('、') }}</span>
            <span class="case-status" :style="{ color: '#1e40af' }">
              {{ statusTextMap[c.status] }}
            </span>
          </div>
          <p class="case-desc">{{ c.description }}</p>
          <span class="case-id">案件号：{{ c.id }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.case-list {
  width: min(560px, 100%);
  text-align: left;
}

.case-list h3 {
  margin: 0 0 12px;
  color: #1f2329;
  font-size: 16px;
}

.case-empty {
  margin: 0;
  padding: 20px;
  background: #ffffff;
  border-radius: 12px;
  color: #9aa4b2;
  font-size: 14px;
  text-align: center;
}

.case-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.case-item {
  padding: 14px 16px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(31, 35, 41, 0.06);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.case-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(30, 64, 175, 0.12);
}

.case-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.case-platforms {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.case-status {
  font-size: 13px;
  font-weight: 600;
}

.case-desc {
  margin: 8px 0 6px;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.case-id {
  color: #9aa4b2;
  font-size: 12px;
}
</style>
