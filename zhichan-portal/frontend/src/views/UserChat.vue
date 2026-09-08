<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Socket } from 'socket.io-client'
import {
  getChatRoom,
  rateCase,
  uploadChatImage,
  type ChatMessageDto,
  type ChatRoomDto,
} from '@/api/cases'
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
const waiting = ref(true)
const ended = ref(false)
const rated = ref(false)
const ratingScore = ref(5)
const ratingFeedback = ref('')
const ratingSubmitting = ref(false)
const error = ref('')
const room = ref<ChatRoomDto | null>(null)
const messages = ref<ChatMessageDto[]>([])
const input = ref('')

let socket: Socket | null = null
let pollTimer: number | undefined

function stopPolling(): void {
  if (pollTimer) {
    window.clearInterval(pollTimer)
  }
  pollTimer = undefined
}

function scrollToBottom(): void {
  requestAnimationFrame(() => {
    const box = document.getElementById('messageList')
    if (box) {
      box.scrollTop = box.scrollHeight
    }
  })
}

function connectRoom(roomId: string): void {
  if (socket) return
  const s = createChatSocket(auth.token)
  socket = s
  s.on('connect', () => joinRoom(s, roomId))
  onReceiveMessage(s, (msg) => {
    messages.value.push(msg)
    scrollToBottom()
  })
  onServiceEnded(s, () => {
    ended.value = true
    s.disconnect()
  })
}

function enterRoom(r: ChatRoomDto): void {
  waiting.value = false
  ended.value = false
  room.value = r
  messages.value = r.messages ?? []
  connectRoom(r.id)
  scrollToBottom()
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const { case: data, room: r } = await getChatRoom(caseId)
    if (data.status === 'READY_TO_CHAT' && r) {
      enterRoom(r)
      stopPolling()
    } else if (data.status === 'COMPLETED') {
      ended.value = true
      waiting.value = false
      stopPolling()
    } else if (data.status === 'PENDING_REVIEW' || data.status === 'APPROVED') {
      error.value = '案件尚未支付，请先完成支付'
      waiting.value = false
    } else {
      waiting.value = true
      startPolling()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败，请稍后重试'
    waiting.value = false
  } finally {
    loading.value = false
  }
}

function startPolling(): void {
  stopPolling()
  pollTimer = window.setInterval(() => {
    void getChatRoom(caseId)
      .then(({ case: data, room: r }) => {
        if (data.status === 'READY_TO_CHAT' && r) {
          stopPolling()
          enterRoom(r)
        } else if (data.status === 'COMPLETED') {
          stopPolling()
          ended.value = true
          waiting.value = false
        }
      })
      .catch(() => {
        // 轮询失败下轮重试
      })
  }, 3000)
}

function send(): void {
  const content = input.value.trim()
  if (!content || !socket || !room.value) return
  sendMessage(socket, room.value.id, content)
  input.value = ''
}

async function sendImage(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file || !socket || !room.value) return
  try {
    const { url } = await uploadChatImage(caseId, file)
    sendMessage(socket, room.value.id, url, 'image')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '图片上传失败'
  } finally {
    target.value = ''
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

async function submitRating(): Promise<void> {
  ratingSubmitting.value = true
  error.value = ''
  try {
    await rateCase(caseId, ratingScore.value, ratingFeedback.value.trim() || undefined)
    rated.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : '评分提交失败'
  } finally {
    ratingSubmitting.value = false
  }
}

onMounted(load)
onUnmounted(() => {
  stopPolling()
  socket?.disconnect()
  socket = null
})
</script>

<template>
  <div class="page">
    <header class="page-header">
      <button type="button" class="back-btn" @click="router.push('/user/home')">← 返回</button>
      <h1>匹配与沟通</h1>
    </header>

    <div v-if="loading" class="center-card">加载中…</div>

    <p v-else-if="error" class="center-card error-text">{{ error }}</p>

    <div v-else-if="ended" class="center-card waiting-card">
      <div class="ended-icon">✅</div>
      <h2>服务已结束</h2>
      <p class="waiting-hint">咨询专员已结束本次服务，感谢您的使用。</p>
      <div v-if="!rated" class="rating-box">
        <p class="rating-title">为本次服务评分</p>
        <div class="stars">
          <button
            v-for="n in 5"
            :key="n"
            type="button"
            class="star"
            :class="{ on: n <= ratingScore }"
            @click="ratingScore = n"
          >
            ★
          </button>
        </div>
        <textarea
          v-model="ratingFeedback"
          class="rating-feedback"
          rows="2"
          placeholder="反馈意见（可选）"
        ></textarea>
        <p v-if="error" class="form-error">{{ error }}</p>
        <button type="button" class="ghost-btn" :disabled="ratingSubmitting" @click="submitRating">
          {{ ratingSubmitting ? '提交中…' : '提交评分' }}
        </button>
      </div>
      <p v-else class="waiting-hint">感谢您的评分！</p>
      <button type="button" class="ghost-btn" @click="router.push('/user/home')">
        返回用户端首页
      </button>
    </div>

    <div v-else-if="waiting" class="center-card waiting-card">
      <div class="spinner"></div>
      <h2>正在为您匹配专员…</h2>
      <p class="waiting-hint">
        专员正在阅读您的材料，确认后双方即可开始沟通。请耐心等待3到5分钟。
      </p>
      <button type="button" class="ghost-btn" @click="router.push('/user/home')">
        返回用户端首页
      </button>
    </div>

    <div v-else-if="room" class="chat-card">
      <div class="chat-header">
        <span>咨询专员：{{ room.expert?.loginId }}</span>
        <span class="online-dot"></span>
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
  max-width: 720px;
  margin: 0 auto 24px;
}

.page-header h1 {
  margin: 12px 0 6px;
  color: #1e40af;
  font-size: 28px;
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

.waiting-card h2 {
  margin: 16px 0 10px;
  color: #1e40af;
}

.waiting-hint {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
  line-height: 1.8;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto;
  border: 4px solid #d9e9fb;
  border-top-color: #1e40af;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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

.chat-card {
  max-width: 720px;
  height: 620px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 18px;
  border-top: 6px solid #1e40af;
  box-shadow: 0 12px 36px rgba(30, 64, 175, 0.12);
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  border-bottom: 1px solid #eef1f5;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.online-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #52c41a;
}

.message-list {
  flex: 1;
  padding: 18px 20px;
  overflow-y: auto;
  background: #f7fafd;
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
  background: #1e40af;
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

.message-time {
  font-size: 11px;
  color: #9aa4b2;
}

.solution-link {
  display: inline-block;
  padding: 10px 14px;
  border-radius: 14px;
  background: #e8f4fd;
  border: 1px solid #bcd7f8;
  color: #1e40af;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.ended-icon {
  font-size: 44px;
}

.rating-box {
  width: 100%;
  margin-top: 16px;
  padding: 16px;
  border-radius: 12px;
  background: #f6faff;
}

.rating-title {
  margin: 0 0 8px;
  color: #1e40af;
  font-size: 14px;
  font-weight: 600;
}

.stars {
  display: flex;
  justify-content: center;
  gap: 6px;
}

.star {
  border: none;
  background: transparent;
  font-size: 26px;
  color: #d9dee5;
  cursor: pointer;
}

.star.on {
  color: #faad14;
}

.rating-feedback {
  width: 100%;
  margin-top: 10px;
  padding: 10px;
  border: 1px solid #d9dee5;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
}

.chat-input-row {
  display: flex;
  gap: 10px;
  padding: 14px 16px;
  border-top: 1px solid #eef1f5;
  background: #ffffff;
}

.image-upload {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 1px solid #d9dee5;
  border-radius: 10px;
  background: #fafbfc;
  font-size: 18px;
  cursor: pointer;
}

.chat-input {
  flex: 1;
  height: 42px;
  padding: 0 14px;
  border: 1px solid #d9dee5;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
}

.chat-input:focus {
  border-color: #1e40af;
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.12);
}

.send-btn {
  height: 42px;
  padding: 0 22px;
  border: none;
  border-radius: 10px;
  background: #1e40af;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
</style>
