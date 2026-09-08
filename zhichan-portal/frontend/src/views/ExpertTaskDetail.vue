<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { confirmRead, getExpertTask } from '@/api/expert'
import type { CaseDto } from '@/api/cases'

const route = useRoute()
const router = useRouter()
const caseId = route.params.caseId as string

const caseInfo = ref<CaseDto | null>(null)
const loading = ref(true)
const error = ref('')
const confirming = ref(false)
const previewUrl = ref('')

async function load(): Promise<void> {
  loading.value = true
  try {
    const { case: data } = await getExpertTask(caseId)
    caseInfo.value = data
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function onConfirm(): Promise<void> {
  confirming.value = true
  error.value = ''
  try {
    await confirmRead(caseId)
    router.push(`/expert/chat/${caseId}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败'
  } finally {
    confirming.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page-header">
      <button type="button" class="back-btn" @click="router.push('/expert/tasks')">← 返回待办</button>
      <h1>案件详情</h1>
    </header>

    <div v-if="loading" class="list-card">
      <p class="empty-text">加载中…</p>
    </div>
    <p v-else-if="error" class="empty-text error-text">{{ error }}</p>

    <div v-else-if="caseInfo" class="detail-card">
      <section class="block">
        <h3>案件信息</h3>
        <p class="row">案件编号：{{ caseInfo.id }}</p>
        <p class="row">
          侵权平台：{{ caseInfo.platforms.join('、') }}<template v-if="caseInfo.otherPlatform">（{{ caseInfo.otherPlatform }}）</template>
        </p>
        <p class="row desc">侵权描述：{{ caseInfo.description }}</p>
      </section>

      <section class="block">
        <h3>用户信息</h3>
        <p class="row">账号：{{ caseInfo.user?.loginId }}</p>
        <p class="row">手机号：{{ caseInfo.user?.phone || '未提供' }}</p>
        <p class="row">邮箱：{{ caseInfo.user?.email || '未提供' }}</p>
      </section>

      <section class="block">
        <h3>原始材料（{{ caseInfo.evidences?.length ?? 0 }} 份）</h3>
        <ul v-if="caseInfo.evidences?.length" class="evidences">
          <li v-for="ev in caseInfo.evidences" :key="ev.id">
            <a :href="ev.url" target="_blank">{{ ev.fileName }}</a>
            <span class="size">（{{ Math.round(ev.size / 1024) }} KB）</span>
            <button type="button" class="preview-btn" @click="previewUrl = ev.url">预览</button>
          </li>
        </ul>
        <p v-else class="empty-text">无证据文件</p>
      </section>

      <p v-if="error" class="form-error">{{ error }}</p>
      <button
        type="button"
        class="primary-btn"
        :disabled="confirming || caseInfo.status !== 'PAID'"
        @click="onConfirm"
      >
        {{ confirming ? '提交中…' : '确认阅读完毕' }}
      </button>
      <p class="hint hint-center">
        确认后案件进入可聊天状态，并通过 WebSocket 通知用户端“专员已就绪”
      </p>
    </div>

    <div v-if="previewUrl" class="pdf-mask" @click="previewUrl = ''">
      <div class="pdf-box" @click.stop>
        <div class="pdf-head">
          <b>PDF 预览</b>
          <button type="button" class="pdf-close" @click="previewUrl = ''">关闭</button>
        </div>
        <iframe :src="previewUrl" class="pdf-frame"></iframe>
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
  text-align: center;
}

.empty-text {
  margin: 0;
  padding: 24px 0;
  color: #9aa4b2;
  font-size: 14px;
}

.error-text {
  max-width: 640px;
  margin: 0 auto;
  text-align: center;
  color: #f5222d;
}

.detail-card {
  max-width: 640px;
  margin: 0 auto;
  padding: 28px;
  background: #ffffff;
  border-radius: 18px;
  border-top: 6px solid #2563eb;
  box-shadow: 0 12px 36px rgba(37, 99, 235, 0.12);
}

.block {
  margin-bottom: 24px;
}

.block h3 {
  margin: 0 0 10px;
  color: #2563eb;
  font-size: 15px;
}

.row {
  margin: 4px 0;
  color: #4b5563;
  font-size: 14px;
  line-height: 1.7;
}

.row.desc {
  white-space: pre-wrap;
}

.evidences {
  margin: 0;
  padding: 0;
  list-style: none;
}

.evidences li {
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: #eff6ff;
  font-size: 13px;
}

.evidences a {
  color: #2563eb;
  text-decoration: none;
}

.size {
  color: #9aa4b2;
}

.primary-btn {
  width: 100%;
  height: 46px;
  border: none;
  border-radius: 999px;
  background: #2563eb;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 2px;
  cursor: pointer;
  transition: filter 0.2s ease, transform 0.2s ease;
}

.primary-btn:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hint-center {
  text-align: center;
  margin-top: 10px;
}

.preview-btn {
  margin-left: 10px;
  padding: 4px 12px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 12px;
  cursor: pointer;
}

.pdf-mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(15, 23, 42, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.pdf-box {
  width: min(860px, 94vw);
  height: 88vh;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.3);
}

.pdf-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid #eef1f5;
}

.pdf-head b {
  font-size: 14px;
  color: #1f2329;
}

.pdf-close {
  padding: 6px 16px;
  border: 1px solid #d9dee5;
  border-radius: 999px;
  background: #ffffff;
  color: #4b5563;
  font-size: 13px;
  cursor: pointer;
}

.pdf-frame {
  flex: 1;
  width: 100%;
  border: none;
  background: #f5f6f8;
}
</style>
