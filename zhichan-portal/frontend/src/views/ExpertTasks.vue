<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listExpertTasks } from '@/api/expert'
import type { CaseDto, CaseStatus } from '@/api/cases'

const router = useRouter()
const cases = ref<CaseDto[]>([])
const loading = ref(true)
const error = ref('')

const statusTextMap: Record<CaseStatus, string> = {
  PENDING_REVIEW: '审核中',
  APPROVED: '待支付',
  PAID: '待确认阅读',
  MATCHING: '匹配中',
  READY_TO_CHAT: '待沟通',
  IN_COMMUNICATION: '沟通中',
  COMPLETED: '已完成',
  REJECTED: '未通过',
}

function openCase(c: CaseDto): void {
  if (c.status === 'READY_TO_CHAT') {
    router.push(`/expert/chat/${c.id}`)
  } else {
    router.push(`/expert/task/${c.id}`)
  }
}

onMounted(async () => {
  try {
    const { cases: list } = await listExpertTasks()
    cases.value = list
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page">
    <header class="page-header">
      <button type="button" class="back-btn" @click="router.push('/expert/home')">← 返回</button>
      <h1>待办案件</h1>
      <p class="sub">已分配给您、等待确认阅读或正在沟通的案件</p>
    </header>

    <div class="list-card">
      <p v-if="loading" class="empty-text">加载中…</p>
      <p v-else-if="error" class="empty-text error-text">{{ error }}</p>
      <p v-else-if="cases.length === 0" class="empty-text">暂无待办案件</p>
      <div v-else class="items">
        <div v-for="c in cases" :key="c.id" class="item" @click="openCase(c)">
          <div class="item-head">
            <span class="platforms">{{ c.platforms.join('、') }}</span>
            <span class="status">{{ statusTextMap[c.status] ?? c.status }}</span>
          </div>
          <p class="desc">{{ c.description }}</p>
          <span class="meta">案件号：{{ c.id }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #eff6ff;
  padding: 32px 20px 56px;
}

.page-header {
  max-width: 640px;
  margin: 0 auto 24px;
}

.page-header h1 {
  margin: 12px 0 6px;
  color: #2563eb;
  font-size: 28px;
}

.sub {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.back-btn {
  padding: 6px 14px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: #ffffff;
  color: #2563eb;
  font-size: 13px;
  cursor: pointer;
}

.list-card {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px;
  background: #ffffff;
  border-radius: 18px;
  border-top: 6px solid #2563eb;
  box-shadow: 0 12px 36px rgba(37, 99, 235, 0.12);
}

.empty-text {
  margin: 0;
  padding: 24px 0;
  color: #9aa4b2;
  font-size: 14px;
  text-align: center;
}

.error-text {
  color: #f5222d;
}

.items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.item {
  padding: 16px;
  border-radius: 12px;
  background: #f8fbff;
  border: 1px solid #dbeafe;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.14);
}

.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.platforms {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.status {
  font-size: 13px;
  font-weight: 600;
  color: #2563eb;
}

.desc {
  margin: 8px 0 6px;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta {
  color: #9aa4b2;
  font-size: 12px;
}
</style>
