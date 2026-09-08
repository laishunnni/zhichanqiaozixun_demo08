<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  createSupervision,
  listRecords,
  listWorkOrders,
  updateWorkOrderStatus,
  type WorkOrderDto,
  type WorkOrderStatus,
} from '@/api/admin'
import type { CaseDto } from '@/api/cases'

type Tab = 'supervision' | 'orders'

const tab = ref<Tab>('supervision')
const completedCases = ref<CaseDto[]>([])
const workOrders = ref<WorkOrderDto[]>([])
const loading = ref(true)
const error = ref('')
const supervisionOpen = ref(false)
const currentCase = ref<CaseDto | null>(null)
const supervisionForm = reactive({ grade: 'QUALIFIED', content: '', suggestion: '' })
const submitting = ref(false)

async function loadSupervision(): Promise<void> {
  try {
    const { cases } = await listRecords({})
    completedCases.value = cases
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  }
}

async function loadOrders(): Promise<void> {
  try {
    const { workOrders: list } = await listWorkOrders()
    workOrders.value = list
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  }
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  await Promise.all([loadSupervision(), loadOrders()])
  loading.value = false
}

function openSupervision(c: CaseDto): void {
  currentCase.value = c
  supervisionForm.grade = 'QUALIFIED'
  supervisionForm.content = ''
  supervisionForm.suggestion = ''
  supervisionOpen.value = true
}

async function submitSupervision(): Promise<void> {
  if (!currentCase.value) return
  if (!supervisionForm.content.trim()) {
    error.value = '请填写监督内容'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    await createSupervision(currentCase.value.id, {
      grade: supervisionForm.grade,
      content: supervisionForm.content.trim(),
      suggestion: supervisionForm.suggestion.trim() || undefined,
    })
    supervisionOpen.value = false
    await loadOrders()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败'
  } finally {
    submitting.value = false
  }
}

async function changeOrderStatus(order: WorkOrderDto, status: WorkOrderStatus): Promise<void> {
  try {
    await updateWorkOrderStatus(order.id, status)
    await loadOrders()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败'
  }
}

const gradeText: Record<string, string> = {
  EXCELLENT: '优秀',
  QUALIFIED: '合格',
  NEEDS_IMPROVEMENT: '待改进',
}

const statusText: Record<WorkOrderStatus, string> = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  CLOSED: '已关闭',
}

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1>质量监管</h1>
      <p class="sub">主动监督评级生成内部工单；用户评分 ≤3 星自动生成投诉工单</p>
    </header>

    <div class="tabs">
      <button type="button" :class="['tab', { active: tab === 'supervision' }]" @click="tab = 'supervision'">
        主动监督
      </button>
      <button type="button" :class="['tab', { active: tab === 'orders' }]" @click="tab = 'orders'">
        工单管理（{{ workOrders.length }}）
      </button>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="loading" class="empty-text">加载中…</p>

    <template v-if="tab === 'supervision'">
      <div class="panel">
        <p v-if="completedCases.length === 0" class="empty-text">暂无已结束案件</p>
        <div v-else class="items">
          <div v-for="c in completedCases" :key="c.id" class="item">
            <div class="item-head">
              <span class="platforms">{{ c.platforms.join('、') }}</span>
              <span class="meta">专员：{{ c.chatRoom?.expert?.loginId ?? '未分配' }}</span>
            </div>
            <p class="desc">{{ c.description }}</p>
            <button type="button" class="grade-btn" @click="openSupervision(c)">评级并生成工单</button>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="panel">
        <p v-if="workOrders.length === 0" class="empty-text">暂无工单</p>
        <div v-else class="items">
          <div v-for="o in workOrders" :key="o.id" class="item order">
            <div class="item-head">
              <span class="platforms">
                {{ o.type === 'COMPLAINT' ? '⚠️ 投诉' : '🛡️ 监督' }}
                {{ o.grade ? `· ${gradeText[o.grade]}` : '' }}
              </span>
              <span class="status">{{ statusText[o.status] }}</span>
            </div>
            <p class="desc">{{ o.title }}：{{ o.content }}</p>
            <p v-if="o.suggestion" class="desc">建议：{{ o.suggestion }}</p>
            <p class="meta">专员：{{ o.expert?.loginId }} · 案件：{{ o.case?.id ?? '—' }}</p>
            <div v-if="o.status !== 'CLOSED'" class="order-actions">
              <button type="button" class="mini-btn" @click="changeOrderStatus(o, 'PROCESSING')">标记处理中</button>
              <button type="button" class="mini-btn danger" @click="changeOrderStatus(o, 'CLOSED')">关闭</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-if="supervisionOpen && currentCase" class="modal-mask" @click="supervisionOpen = false">
      <div class="modal" @click.stop>
        <h3>评级与工单</h3>
        <p class="meta">案件：{{ currentCase.id }}</p>
        <select v-model="supervisionForm.grade" class="select">
          <option value="EXCELLENT">优秀</option>
          <option value="QUALIFIED">合格</option>
          <option value="NEEDS_IMPROVEMENT">待改进</option>
        </select>
        <textarea v-model="supervisionForm.content" class="textarea" rows="3" placeholder="监督内容"></textarea>
        <textarea v-model="supervisionForm.suggestion" class="textarea" rows="2" placeholder="改进建议（后台私信发给专员，可选）"></textarea>
        <div class="modal-actions">
          <button type="button" class="primary-btn" :disabled="submitting" @click="submitSupervision">
            {{ submitting ? '提交中…' : '生成工单' }}
          </button>
          <button type="button" class="ghost-btn" @click="supervisionOpen = false">取消</button>
        </div>
      </div>
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

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.tab {
  padding: 9px 22px;
  border: 1px solid #d9dee5;
  border-radius: 999px;
  background: #ffffff;
  color: #5b6470;
  font-size: 14px;
  cursor: pointer;
}

.tab.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #ffffff;
  font-weight: 600;
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
}

.status {
  padding: 2px 10px;
  border-radius: 999px;
  background: #dbeafe;
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
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

.grade-btn {
  margin-top: 8px;
  padding: 8px 18px;
  border: none;
  border-radius: 999px;
  background: #3b82f6;
  color: #ffffff;
  font-size: 13px;
  cursor: pointer;
}

.order-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.mini-btn {
  padding: 6px 14px;
  border: 1px solid #dbeafe;
  border-radius: 999px;
  background: #ffffff;
  color: #3b82f6;
  font-size: 12px;
  cursor: pointer;
}

.mini-btn.danger {
  color: #f5222d;
  border-color: #ffd6d9;
}

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(31, 35, 41, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal {
  width: min(460px, 100%);
  padding: 24px;
  background: #ffffff;
  border-radius: 16px;
}

.modal h3 {
  margin: 0 0 8px;
  color: #3b82f6;
}

.select {
  width: 100%;
  height: 42px;
  margin: 12px 0;
  padding: 0 12px;
  border: 1px solid #d9dee5;
  border-radius: 8px;
  font-size: 14px;
}

.textarea {
  width: 100%;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid #d9dee5;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.primary-btn {
  flex: 1;
  height: 42px;
  border: none;
  border-radius: 999px;
  background: #3b82f6;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
}

.ghost-btn {
  flex: 1;
  height: 42px;
  border: 1px solid #dbeafe;
  border-radius: 999px;
  background: #ffffff;
  color: #3b82f6;
  font-size: 14px;
  cursor: pointer;
}
</style>
