<script setup lang="ts">
import { onUnmounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createCase, getCase, uploadEvidence, type CaseStatus } from '@/api/cases'

const PLATFORM_OPTIONS = ['小红书', '抖音', 'Bilibili', '微信公众号', '其他']
const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'docx']

const router = useRouter()

const form = reactive({
  platforms: [] as string[],
  otherPlatform: '',
  description: '',
  contactPhone: '',
  contactEmail: '',
})
const files = ref<File[]>([])
const error = ref('')
const submitting = ref(false)
const submitted = ref(false)
const caseId = ref('')
const currentStatus = ref('')
let pollTimer: number | undefined

const statusTextMap: Record<CaseStatus, string> = {
  PENDING_REVIEW: '审核中',
  APPROVED: '审核通过，即将跳转支付',
  PAID: '已支付',
  MATCHING: '匹配专员中',
  READY_TO_CHAT: '沟通中',
  IN_COMMUNICATION: '沟通中',
  COMPLETED: '已完成',
  REJECTED: '未通过',
}

function togglePlatform(name: string): void {
  const idx = form.platforms.indexOf(name)
  if (idx >= 0) {
    form.platforms.splice(idx, 1)
  } else {
    form.platforms.push(name)
  }
}

function validateFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `不支持的文件格式：${file.name}`
  }
  if (file.size > MAX_FILE_SIZE) {
    return `文件超过 10MB：${file.name}`
  }
  return null
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const picked = Array.from(input.files ?? [])
  for (const f of picked) {
    const msg = validateFile(f)
    if (msg) {
      error.value = msg
      continue
    }
    files.value.push(f)
  }
  input.value = ''
}

function removeFile(index: number): void {
  files.value.splice(index, 1)
}

function formatSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`
  }
  return `${Math.round(size / 1024)} KB`
}

async function submit(): Promise<void> {
  error.value = ''
  if (form.platforms.length === 0) {
    error.value = '请选择至少一个侵权平台'
    return
  }
  if (form.platforms.includes('其他') && !form.otherPlatform.trim()) {
    error.value = '请填写其他平台名称'
    return
  }
  if (form.description.trim().length < 20) {
    error.value = '侵权描述至少 20 字'
    return
  }
  if (!form.contactPhone.trim() && !form.contactEmail.trim()) {
    error.value = '请填写手机号或邮箱联系方式（二选一）'
    return
  }
  if (files.value.length === 0) {
    error.value = '请至少上传 1 份证据文件'
    return
  }

  submitting.value = true
  try {
    const { case: created } = await createCase({
      platforms: form.platforms,
      otherPlatform: form.otherPlatform.trim() || undefined,
      description: form.description.trim(),
      contactPhone: form.contactPhone.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
    })
    caseId.value = created.id
    for (const f of files.value) {
      await uploadEvidence(created.id, f)
    }
    submitted.value = true
    startPolling(created.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '提交失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}

function stopPolling(): void {
  if (pollTimer) {
    window.clearInterval(pollTimer)
  }
  pollTimer = undefined
}

function startPolling(id: string): void {
  const poll = async (): Promise<void> => {
    try {
      const { case: data } = await getCase(id)
      currentStatus.value = statusTextMap[data.status] ?? data.status
      if (data.status === 'APPROVED') {
        stopPolling()
        router.push(`/user/pay/${id}`)
      } else if (data.status === 'REJECTED') {
        stopPolling()
        submitted.value = false
        error.value = '材料审核未通过，请修改后重新提交'
      }
    } catch {
      // 轮询失败下轮重试
    }
  }
  void poll()
  pollTimer = window.setInterval(() => void poll(), 3000)
}

onUnmounted(stopPolling)
</script>

<template>
  <div class="page">
    <header class="page-header">
      <button type="button" class="back-btn" @click="router.push('/user/home')">← 返回</button>
      <h1>提交侵权材料</h1>
      <p class="sub">材料提交后将进入审核，审核通过自动跳转支付</p>
    </header>

    <form v-if="!submitted" class="submit-card" @submit.prevent="submit">
      <div class="form-block">
        <label class="block-label">侵权平台（多选）</label>
        <div class="checkbox-group">
          <label v-for="p in PLATFORM_OPTIONS" :key="p" class="checkbox-item">
            <input
              type="checkbox"
              :checked="form.platforms.includes(p)"
              @change="togglePlatform(p)"
            />
            <span>{{ p }}</span>
          </label>
        </div>
        <input
          v-if="form.platforms.includes('其他')"
          v-model="form.otherPlatform"
          class="text-input"
          type="text"
          placeholder="请输入其他平台名称"
        />
      </div>

      <div class="form-block">
        <label class="block-label" for="description">侵权描述（至少 20 字）</label>
        <textarea
          id="description"
          v-model="form.description"
          class="text-area"
          rows="5"
          placeholder="请详细描述侵权情况…"
        ></textarea>
        <p
          class="counter"
          :class="{ warn: form.description.length > 0 && form.description.length < 20 }"
        >
          {{ form.description.length }} 字（20 字起）
        </p>
      </div>

      <div class="form-block">
        <label class="block-label">证据上传（jpg/png/pdf/docx，≤10MB，至少 1 份）</label>
        <label class="upload-area">
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.pdf,.docx"
            @change="onFileChange"
          />
          <span>点击选择或拖入证据文件</span>
        </label>
        <ul v-if="files.length" class="file-list">
          <li v-for="(f, i) in files" :key="`${f.name}-${i}`">
            <span>{{ f.name }}（{{ formatSize(f.size) }}）</span>
            <button type="button" @click="removeFile(i)">移除</button>
          </li>
        </ul>
      </div>

      <div class="form-block">
        <label class="block-label">联系方式（手机号或邮箱，二选一）</label>
        <input v-model="form.contactPhone" class="text-input" type="tel" placeholder="手机号" />
        <input v-model="form.contactEmail" class="text-input" type="email" placeholder="邮箱" />
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>
      <button type="submit" class="primary-btn" :disabled="submitting">
        {{ submitting ? '提交中…' : '提交材料' }}
      </button>
    </form>

    <div v-else class="submit-card status-card">
      <div class="status-icon">⏳</div>
      <h2>材料已提交</h2>
      <p class="status-text">案件号：{{ caseId }}</p>
      <p class="status-text">当前状态：{{ currentStatus || '审核中' }}</p>
      <p class="hint">审核通过后将自动跳转支付页，请稍候…</p>
      <button type="button" class="ghost-btn" @click="router.push('/user/home')">
        返回用户端首页
      </button>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #e8f4fd;
  padding: 32px 20px 56px;
}

.page-header {
  max-width: 640px;
  margin: 0 auto 24px;
}

.page-header h1 {
  margin: 12px 0 6px;
  color: #1e40af;
  font-size: 28px;
}

.sub {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.back-btn {
  padding: 6px 14px;
  border: 1px solid #cfe4fb;
  border-radius: 999px;
  background: #ffffff;
  color: #1e40af;
  font-size: 13px;
  cursor: pointer;
}

.submit-card {
  max-width: 640px;
  margin: 0 auto;
  padding: 32px;
  background: #ffffff;
  border-radius: 18px;
  border-top: 6px solid #1e40af;
  box-shadow: 0 12px 36px rgba(30, 64, 175, 0.12);
}

.form-block {
  margin-bottom: 26px;
}

.block-label {
  display: block;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.checkbox-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid #d9dee5;
  border-radius: 999px;
  background: #fafbfc;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.checkbox-item:has(input:checked) {
  border-color: #1e40af;
  background: rgba(30, 64, 175, 0.08);
  color: #1e40af;
}

.text-input {
  width: 100%;
  height: 42px;
  margin-top: 12px;
  padding: 0 14px;
  border: 1px solid #d9dee5;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}

.text-input:focus,
.text-area:focus {
  border-color: #1e40af;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.12);
}

.text-area {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #d9dee5;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  outline: none;
}

.counter {
  margin: 6px 0 0;
  font-size: 12px;
  color: #9aa4b2;
  text-align: right;
}

.counter.warn {
  color: #f5222d;
}

.upload-area {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96px;
  border: 2px dashed #bcd7f8;
  border-radius: 12px;
  background: #f6faff;
  color: #1e40af;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.upload-area:hover {
  background: #edf5ff;
}

.upload-area input {
  display: none;
}

.file-list {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.file-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: #f6faff;
  font-size: 13px;
  color: #4b5563;
}

.file-list button {
  border: none;
  background: transparent;
  color: #f5222d;
  font-size: 13px;
  cursor: pointer;
}

.primary-btn {
  width: 100%;
  height: 46px;
  border: none;
  border-radius: 999px;
  background: #1e40af;
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

.status-card {
  text-align: center;
}

.status-icon {
  font-size: 44px;
}

.status-card h2 {
  margin: 12px 0 8px;
  color: #1e40af;
}

.status-text {
  margin: 4px 0;
  color: #4b5563;
  font-size: 14px;
}

.ghost-btn {
  margin-top: 20px;
  padding: 10px 26px;
  border: 1px solid #bcd7f8;
  border-radius: 999px;
  background: #ffffff;
  color: #1e40af;
  font-size: 14px;
  cursor: pointer;
}
</style>
