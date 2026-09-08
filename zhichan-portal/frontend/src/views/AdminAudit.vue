<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getAdminCase, listAdminCases, reviewCase } from '@/api/admin'
import type { CaseDto } from '@/api/cases'

const cases = ref<CaseDto[]>([])
const loading = ref(true)
const error = ref('')
const detail = ref<CaseDto | null>(null)
const drawerOpen = ref(false)
const rejectOpen = ref(false)
const rejectReason = ref('')
const submitting = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    const { cases: list } = await listAdminCases('PENDING_REVIEW')
    cases.value = list
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function openDetail(caseId: string): Promise<void> {
  try {
    const { case: data } = await getAdminCase(caseId)
    detail.value = data
    drawerOpen.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  }
}

async function approve(): Promise<void> {
  if (!detail.value) return
  submitting.value = true
  error.value = ''
  try {
    await reviewCase(detail.value.id, true)
    drawerOpen.value = false
    rejectOpen.value = false
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败'
  } finally {
    submitting.value = false
  }
}

async function reject(): Promise<void> {
  if (!detail.value) return
  if (!rejectReason.value.trim()) {
    error.value = '请填写驳回理由'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    await reviewCase(detail.value.id, false, rejectReason.value.trim())
    drawerOpen.value = false
    rejectOpen.value = false
    rejectReason.value = ''
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败'
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1>材料审核</h1>
      <p class="sub">待审核案件（PENDING_REVIEW），审核通过后将触发用户端支付流程</p>
    </header>

    <div class="panel">
      <p v-if="loading" class="empty-text">加载中…</p>
      <p v-else-if="error" class="empty-text error-text">{{ error }}</p>
      <p v-else-if="cases.length === 0" class="empty-text">暂无待审核案件</p>
      <div v-else class="items">
        <div v-for="c in cases" :key="c.id" class="item" @click="openDetail(c.id)">
          <div class="item-head">
            <span class="platforms">{{ c.platforms.join('、') }}</span>
            <span class="meta">提交于 {{ new Date(c.createdAt).toLocaleString('zh-CN') }}</span>
          </div>
          <p class="desc">{{ c.description }}</p>
          <span class="meta">案件号：{{ c.id }}</span>
        </div>
      </div>
    </div>

    <div v-if="drawerOpen && detail" class="drawer-mask" @click="drawerOpen = false">
      <aside class="drawer" @click.stop>
        <h3>案件详情</h3>
        <p class="row">案件编号：{{ detail.id }}</p>
        <p class="row">侵权平台：{{ detail.platforms.join('、') }}<template v-if="detail.otherPlatform">（{{ detail.otherPlatform }}）</template></p>
        <p class="row">侵权描述：{{ detail.description }}</p>
        <p class="row">用户：{{ detail.user?.loginId }}（{{ detail.user?.phone || detail.user?.email || '无联系方式' }}）</p>
        <h4>证据材料（{{ detail.evidences?.length ?? 0 }}）</h4>
        <ul v-if="detail.evidences?.length" class="file-list">
          <li v-for="ev in detail.evidences" :key="ev.id">
            <a :href="ev.url" target="_blank">{{ ev.fileName }}</a>
          </li>
        </ul>
        <p v-else class="empty-text">无证据文件</p>

        <p v-if="error" class="form-error">{{ error }}</p>

        <template v-if="!rejectOpen">
          <button type="button" class="primary-btn approve" :disabled="submitting" @click="approve">
            {{ submitting ? '处理中…' : '✅ 审核通过' }}
          </button>
          <button type="button" class="ghost-btn reject" @click="rejectOpen = true">驳回并填写理由</button>
        </template>
        <template v-else>
          <textarea v-model="rejectReason" class="reject-input" rows="3" placeholder="请填写驳回理由，将通知用户补充材料"></textarea>
          <div class="btn-row">
            <button type="button" class="primary-btn approve" :disabled="submitting" @click="reject">确认驳回</button>
            <button type="button" class="ghost-btn" @click="rejectOpen = false">取消</button>
          </div>
        </template>
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

.panel {
  padding: 24px;
  background: #ffffff;
  border-radius: 18px;
  border-top: 6px solid #3b82f6;
  box-shadow: 0 12px 36px rgba(59, 130, 246, 0.1);
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
  background: #f4f8ff;
  border: 1px solid #dbeafe;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.12);
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

.drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: rgba(31, 35, 41, 0.4);
  display: flex;
  justify-content: flex-end;
}

.drawer {
  width: min(440px, 92vw);
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

.file-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.file-list li {
  padding: 8px 10px;
  margin-bottom: 6px;
  border-radius: 8px;
  background: #f4f8ff;
  font-size: 13px;
}

.file-list a {
  color: #3b82f6;
  text-decoration: none;
}

.primary-btn {
  width: 100%;
  height: 44px;
  margin-top: 16px;
  border: none;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.primary-btn.approve {
  background: #3b82f6;
  color: #ffffff;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ghost-btn {
  display: block;
  width: 100%;
  margin-top: 12px;
  padding: 12px;
  border: 1px solid #dbeafe;
  border-radius: 999px;
  background: #ffffff;
  color: #3b82f6;
  font-size: 14px;
  cursor: pointer;
}

.ghost-btn.reject {
  color: #f5222d;
  border-color: #ffd6d9;
}

.reject-input {
  width: 100%;
  margin-top: 16px;
  padding: 12px;
  border: 1px solid #d9dee5;
  border-radius: 10px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  outline: none;
}

.btn-row {
  display: flex;
  gap: 10px;
}

.btn-row .primary-btn,
.btn-row .ghost-btn {
  flex: 1;
  margin-top: 12px;
}
</style>
