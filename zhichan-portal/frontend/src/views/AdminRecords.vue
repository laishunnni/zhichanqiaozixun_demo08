<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { getRecord, listRecords } from '@/api/admin'
import type { CaseDto, ChatMessageDto } from '@/api/cases'

const filters = reactive({ caseId: '', expertId: '', from: '', to: '' })
const records = ref<CaseDto[]>([])
const loading = ref(true)
const error = ref('')
const detail = ref<CaseDto | null>(null)
const drawerOpen = ref(false)

async function search(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const { cases } = await listRecords({
      caseId: filters.caseId || undefined,
      expertId: filters.expertId || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    })
    records.value = cases
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function openDetail(caseId: string): Promise<void> {
  try {
    const { case: data } = await getRecord(caseId)
    detail.value = data
    drawerOpen.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  }
}

function senderName(m: ChatMessageDto): string {
  return m.sender?.loginId ?? m.senderId
}

onMounted(search)
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1>全程监控与记录</h1>
      <p class="sub">按案件 ID / 专员编号 / 日期范围检索已结束案例，查看完整聊天记录与评分反馈</p>
    </header>

    <div class="filter-card">
      <input v-model="filters.caseId" class="filter-input" type="text" placeholder="案件 ID" />
      <input v-model="filters.expertId" class="filter-input" type="text" placeholder="专员编号" />
      <input v-model="filters.from" class="filter-input" type="date" title="开始日期" />
      <input v-model="filters.to" class="filter-input" type="date" title="结束日期" />
      <button type="button" class="search-btn" @click="search">查询</button>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>

    <div class="panel">
      <p v-if="loading" class="empty-text">加载中…</p>
      <p v-else-if="records.length === 0" class="empty-text">暂无已结束案件记录</p>
      <div v-else class="items">
        <div v-for="c in records" :key="c.id" class="item" @click="openDetail(c.id)">
          <div class="item-head">
            <span class="platforms">{{ c.platforms.join('、') }}</span>
            <span class="meta">专员：{{ c.expert ? '#' + c.expert.loginId : '未分配' }}</span>
          </div>
          <p class="desc">{{ c.description }}</p>
          <div class="item-foot">
            <span class="meta">案件号：{{ c.id }}</span>
            <span v-if="c.rating" class="rating">评分：{{ '★'.repeat(c.rating.score) }}<template v-if="c.rating.feedback"> · {{ c.rating.feedback }}</template></span>
            <span v-else class="meta">未评分</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="drawerOpen && detail" class="drawer-mask" @click="drawerOpen = false">
      <aside class="drawer" @click.stop>
        <h3>案件记录</h3>
        <p class="row">案件：{{ detail.id }}</p>
        <p class="row">专员：{{ detail.chatRoom?.expert?.loginId ?? '—' }}</p>
        <p class="row">用户：{{ detail.user?.loginId }}</p>
        <p v-if="detail.rating" class="row">
          评分：{{ '★'.repeat(detail.rating.score) }}
          <span v-if="detail.rating.feedback">（{{ detail.rating.feedback }}）</span>
        </p>
        <h4>完整聊天记录（只读）</h4>
        <div class="chat-log">
          <div v-for="m in detail.chatRoom?.messages ?? []" :key="m.id" class="log-line">
            <span class="log-sender">{{ senderName(m) }}</span>
            <span class="log-content">
              <a v-if="m.type === 'solution'" :href="m.content" target="_blank">📄 解决方案 PDF</a>
              <img v-else-if="m.type === 'image'" :src="m.content" class="log-img" alt="图片" />
              <template v-else>{{ m.content }}</template>
            </span>
            <span class="log-time">{{ new Date(m.createdAt).toLocaleString('zh-CN') }}</span>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.page-header h1 {
  margin: 0 0 6px;
  color: #3b82f6;
  font-size: 26px;
}

.sub {
  margin: 0 0 18px;
  color: #6b7280;
  font-size: 14px;
}

.filter-card {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  padding: 16px;
  background: #ffffff;
  border-radius: 14px;
  flex-wrap: wrap;
}

.filter-input {
  flex: 1;
  min-width: 140px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #d9dee5;
  border-radius: 8px;
  font-size: 14px;
}

.search-btn {
  padding: 0 24px;
  border: none;
  border-radius: 999px;
  background: #3b82f6;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
}

.panel {
  padding: 20px;
  background: #ffffff;
  border-radius: 18px;
  border-top: 6px solid #3b82f6;
  box-shadow: 0 12px 36px rgba(59, 130, 246, 0.1);
}

.empty-text {
  margin: 0;
  padding: 24px 0;
  color: #9aa4b2;
  text-align: center;
}

.items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.item {
  padding: 14px 16px;
  border-radius: 12px;
  background: #f4f8ff;
  border: 1px solid #dbeafe;
  cursor: pointer;
}

.item-head,
.item-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.platforms {
  font-weight: 600;
  font-size: 14px;
}

.desc {
  margin: 8px 0 6px;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.6;
}

.meta {
  color: #9aa4b2;
  font-size: 12px;
}

.rating {
  color: #2563eb;
  font-size: 13px;
}

.drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: rgba(31, 35, 41, 0.4);
  display: flex;
  justify-content: flex-end;
}

.drawer {
  width: min(520px, 94vw);
  height: 100%;
  padding: 24px;
  background: #ffffff;
  overflow-y: auto;
  box-shadow: -8px 0 32px rgba(31, 35, 41, 0.12);
}

.drawer h3 {
  margin: 0 0 14px;
  color: #3b82f6;
}

.drawer h4 {
  margin: 18px 0 8px;
  font-size: 14px;
}

.row {
  margin: 4px 0;
  color: #4b5563;
  font-size: 13px;
  line-height: 1.7;
}

.chat-log {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 52vh;
  overflow-y: auto;
  padding: 12px;
  background: #f7fafd;
  border-radius: 12px;
}

.log-line {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.log-sender {
  color: #3b82f6;
  font-size: 12px;
  font-weight: 600;
}

.log-content {
  font-size: 13px;
  color: #1f2329;
  word-break: break-word;
}

.log-img {
  max-width: 160px;
  border-radius: 8px;
}

.log-time {
  color: #b0b8c4;
  font-size: 11px;
}
</style>
