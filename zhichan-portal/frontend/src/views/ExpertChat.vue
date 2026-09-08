<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Socket } from 'socket.io-client'
import {
  endService,
  getExpertRoom,
  uploadExpertChatImage,
  uploadSolutionFile,
} from '@/api/expert'
import type { CaseDto, ChatMessageDto, ChatRoomDto } from '@/api/cases'
import { useAuthStore } from '@/stores/auth'
import {
  createChatSocket,
  joinRoom,
  onReceiveMessage,
  onServiceEnded,
  sendMessage,
} from '@/socket/chat'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const caseId = route.params.caseId as string

const loading = ref(true)
const error = ref('')
const ended = ref(false)
const room = ref<ChatRoomDto | null>(null)
const messages = ref<ChatMessageDto[]>([])
const caseInfo = ref<CaseDto | null>(null)
const drawerOpen = ref(false)
const uploadingSolution = ref(false)
const ending = ref(false)
const input = ref('')
const previewUrl = ref('')

let socket: Socket | null = null

function scrollToBottom(): void {
  requestAnimationFrame(() => {
    const box = document.getElementById('messageList')
    if (box) {
      box.scrollTop = box.scrollHeight
    }
  })
}

function appendMessage(m: ChatMessageDto): void {
  messages.value.push(m)
  scrollToBottom()
}

function connectRoom(roomId: string): void {
  if (socket) return
  const s = createChatSocket(auth.token)
  socket = s
  s.on('connect', () => joinRoom(s, roomId))
  onReceiveMessage(s, appendMessage)
  onServiceEnded(s, () => {
    ended.value = true
    s.disconnect()
  })
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const { case: data, room: r } = await getExpertRoom(caseId)
    caseInfo.value = data
    if (data.status === 'READY_TO_CHAT' && r) {
      room.value = r
      messages.value = r.messages ?? []
      connectRoom(r.id)
      scrollToBottom()
    } else if (data.status === 'COMPLETED') {
      ended.value = true
    } else {
      error.value = '案件尚未进入可沟通状态'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function send(): void {
  const content = input.value.trim()
  if (!content || !socket || !room.value || ended.value) return
  sendMessage(socket, room.value.id, content)
  input.value = ''
}

async function sendImage(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !socket || !room.value) return
  try {
    const { url } = await uploadExpertChatImage(caseId, file)
    sendMessage(socket, room.value.id, url, 'image')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '图片上传失败'
  } finally {
    target.value = ''
  }
}

async function onUploadSolution(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  uploadingSolution.value = true
  error.value = ''
  try {
    await uploadSolutionFile(caseId, file)
    // 方案消息由服务端广播到房间（receive_message），客户端自动展示
  } catch (e) {
    error.value = e instanceof Error ? e.message : '上传失败'
  } finally {
    uploadingSolution.value = false
    target.value = ''
  }
}

async function onEndService(): Promise<void> {
  ending.value = true
  error.value = ''
  try {
    await endService(caseId)
    ended.value = true
    socket?.disconnect()
    socket = null
    setTimeout(() => router.push('/expert/tasks'), 1500)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败'
  } finally {
    ending.value = false
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(load)
onUnmounted(() => {
  socket?.disconnect()
  socket = null
})
</script>

<template>
  <div class="page">
    <header class="page-header">
      <button type="button" class="back-btn" @click="router.push('/expert/tasks')">← 返回待办</button>
      <h1>案件沟通</h1>
    </header>

    <div v-if="loading" class="center-card">加载中…</div>
    <p v-else-if="error" class="center-card error-text">{{ error }}</p>

    <div v-else-if="ended" class="center-card">
      <div class="ended-icon">✅</div>
      <h2>服务已结束</h2>
      <p class="hint hint-center">案件已标记为完成，正在返回待办列表…</p>
    </div>

    <div v-else-if="room" class="chat-wrap">
      <div class="chat-box">
        <div class="chat-head">
          <span>咨询用户：{{ caseInfo?.user?.loginId }}</span>
          <button type="button" class="drawer-toggle" @click="drawerOpen = !drawerOpen">
            📁 查看原始材料
          </button>
        </div>

        <div id="messageList" class="message-list">
          <div
            v-for="m in messages"
            :key="m.id"
            :class="['message', m.senderId === auth.user?.id ? 'mine' : 'theirs']"
          >
            <img v-if="m.type === 'image'" :src="m.content" class="message-image" alt="图片消息" />
            <a
              v-else-if="m.type === 'solution'"
              :href="m.content"
              target="_blank"
              class="solution-link"
            >
              📄 下载解决方案 PDF
            </a>
            <span v-else class="message-bubble">{{ m.content }}</span>
            <span class="message-time">{{ formatTime(m.createdAt) }}</span>
          </div>
        </div>

        <div class="chat-input-row">
          <label class="image-upload">
            <span>🖼</span>
            <input type="file" accept="image/*" hidden @change="sendImage" />
          </label>
          <input
            v-model="input"
            class="chat-input"
            type="text"
            placeholder="输入消息…"
            @keydown.enter="send"
          />
          <button type="button" class="send-btn" @click="send">发送</button>
        </div>

        <div class="action-row">
          <label class="action-btn upload" :class="{ disabled: uploadingSolution }">
            {{ uploadingSolution ? '上传中…' : '📎 上传本地方案' }}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              hidden
              :disabled="uploadingSolution"
              @change="onUploadSolution"
            />
          </label>
          <button
            type="button"
            class="action-btn end"
            :disabled="ending"
            @click="onEndService"
          >
            {{ ending ? '处理中…' : '✅ 结束服务' }}
          </button>
        </div>
      </div>

      <div v-if="drawerOpen" class="drawer-mask" @click="drawerOpen = false">
        <aside class="drawer" @click.stop>
          <h3>原始材料</h3>
          <p class="drawer-meta">案件：{{ caseId }}</p>
          <p class="drawer-meta">平台：{{ caseInfo?.platforms.join('、') }}</p>
          <p class="drawer-desc">{{ caseInfo?.description }}</p>
          <h4>证据文件（{{ caseInfo?.evidences?.length ?? 0 }}）</h4>
          <ul v-if="caseInfo?.evidences?.length" class="drawer-files">
            <li v-for="ev in caseInfo.evidences" :key="ev.id">
              <a :href="ev.url" target="_blank">{{ ev.fileName }}</a>
              <button type="button" class="drawer-preview" @click="previewUrl = ev.url">预览</button>
            </li>
          </ul>
          <p v-else class="drawer-empty">无证据文件</p>
          <button type="button" class="ghost-btn" @click="drawerOpen = false">关闭</button>
        </aside>
      </div>
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
  max-width: 760px;
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

.center-card {
  max-width: 520px;
  margin: 0 auto;
  padding: 40px;
  background: #ffffff;
  border-radius: 18px;
  text-align: center;
  color: #6b7280;
}

.error-text {
  color: #f5222d;
}

.ended-icon {
  font-size: 44px;
}

.center-card h2 {
  margin: 14px 0 8px;
  color: #2563eb;
}

.hint-center {
  text-align: center;
}

.chat-wrap {
  max-width: 760px;
  margin: 0 auto;
}

.chat-box {
  height: 640px;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 18px;
  border-top: 6px solid #2563eb;
  box-shadow: 0 12px 36px rgba(37, 99, 235, 0.12);
  overflow: hidden;
}

.chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid #dbeafe;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.drawer-toggle {
  padding: 6px 12px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 13px;
  cursor: pointer;
}

.message-list {
  flex: 1;
  padding: 18px 20px;
  overflow-y: auto;
  background: #f8fbff;
}

.message {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
  max-width: 70%;
}

.message.mine {
  align-items: flex-end;
  margin-left: auto;
}

.message.theirs {
  align-items: flex-start;
}

.message-bubble {
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

.message.mine .message-bubble {
  background: #2563eb;
  color: #ffffff;
  border-bottom-right-radius: 4px;
}

.message.theirs .message-bubble {
  background: #ffffff;
  color: #1f2329;
  border-bottom-left-radius: 4px;
  box-shadow: 0 2px 8px rgba(31, 35, 41, 0.06);
}

.message-image {
  max-width: 220px;
  max-height: 220px;
  border-radius: 12px;
}

.solution-link {
  display: inline-block;
  padding: 10px 14px;
  border-radius: 14px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #2563eb;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.message-time {
  font-size: 11px;
  color: #9aa4b2;
}

.chat-input-row {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid #dbeafe;
  background: #ffffff;
}

.image-upload {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  background: #f8fbff;
  font-size: 18px;
  cursor: pointer;
}

.chat-input {
  flex: 1;
  height: 42px;
  padding: 0 14px;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
}

.chat-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.send-btn {
  height: 42px;
  padding: 0 22px;
  border: none;
  border-radius: 10px;
  background: #2563eb;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.action-row {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid #dbeafe;
  background: #ffffff;
}

.action-btn {
  flex: 1;
  height: 42px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.2s ease, transform 0.2s ease;
}

.action-btn:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.solution {
  background: #2563eb;
  color: #ffffff;
}

.action-btn.upload {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eff6ff;
  border: 1px dashed #bfdbfe;
  color: #2563eb;
  cursor: pointer;
}

.action-btn.upload.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.end {
  background: #dbeafe;
  color: #2563eb;
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
  width: min(360px, 88vw);
  height: 100%;
  padding: 24px;
  background: #ffffff;
  box-shadow: -8px 0 32px rgba(31, 35, 41, 0.12);
  overflow-y: auto;
}

.drawer h3 {
  margin: 0 0 14px;
  color: #2563eb;
}

.drawer h4 {
  margin: 18px 0 8px;
  color: #1f2329;
  font-size: 14px;
}

.drawer-meta {
  margin: 4px 0;
  color: #4b5563;
  font-size: 13px;
}

.drawer-desc {
  margin: 10px 0 0;
  padding: 12px;
  border-radius: 10px;
  background: #eff6ff;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.7;
}

.drawer-files {
  margin: 0;
  padding: 0;
  list-style: none;
}

.drawer-files li {
  padding: 8px 10px;
  margin-bottom: 6px;
  border-radius: 8px;
  background: #eff6ff;
  font-size: 13px;
}

.drawer-files a {
  color: #2563eb;
  text-decoration: none;
}

.drawer-empty {
  color: #9aa4b2;
  font-size: 13px;
}

.ghost-btn {
  margin-top: 20px;
  padding: 10px 26px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: #ffffff;
  color: #2563eb;
  font-size: 14px;
  cursor: pointer;
}

.drawer-preview {
  margin-left: 8px;
  padding: 3px 10px;
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
