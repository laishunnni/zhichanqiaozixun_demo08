<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { createOrder, getCase, mockPay, type CaseDto } from '@/api/cases'

const route = useRoute()
const router = useRouter()
const caseId = route.params.caseId as string

const caseInfo = ref<CaseDto | null>(null)
const loading = ref(true)
const paying = ref(false)
const error = ref('')

// 扫码支付弹窗
const qrModal = ref(false)
const qrImg = ref('')
const qrChannel = ref('')
let payTimer: number | undefined

async function load(): Promise<void> {
  loading.value = true
  try {
    const { case: data } = await getCase(caseId)
    caseInfo.value = data
    if (
      data.status === 'PAID' ||
      data.status === 'MATCHING' ||
      data.status === 'READY_TO_CHAT' ||
      data.status === 'COMPLETED'
    ) {
      router.replace(`/user/chat/${caseId}`)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function stopPolling(): void {
  if (payTimer) {
    window.clearInterval(payTimer)
    payTimer = undefined
  }
}

function startPolling(): void {
  stopPolling()
  payTimer = window.setInterval(() => {
    void getCase(caseId)
      .then(({ case: data }) => {
        if (
          data.status === 'PAID' ||
          data.status === 'MATCHING' ||
          data.status === 'READY_TO_CHAT' ||
          data.status === 'COMPLETED'
        ) {
          stopPolling()
          qrModal.value = false
          router.replace(`/user/chat/${caseId}`)
        }
      })
      .catch(() => {
        // 轮询失败下轮重试
      })
  }, 3000)
}

async function pay(method: 'WECHAT' | 'ALIPAY'): Promise<void> {
  error.value = ''
  paying.value = true
  try {
    const res = await createOrder(caseId, method)
    const payment = res.payment

    // 模拟模式：直接完成支付
    if (!payment || payment.mode === 'mock') {
      await mockPay(caseId, res.order.id)
      router.replace(`/user/chat/${caseId}`)
      return
    }

    // 收银台跳转模式（通道不支持本地二维码时，跳转第三方收银台）
    if (payment.mode === 'redirect' && payment.redirectUrl) {
      window.location.href = payment.redirectUrl
      return
    }

    // 扫码支付：生成二维码并轮询支付结果
    if (payment.mode === 'qrcode' && payment.qrContent) {
      qrImg.value = await QRCode.toDataURL(payment.qrContent, { width: 260, margin: 2 })
      qrChannel.value = payment.channel ?? ''
      qrModal.value = true
      startPolling()
      return
    }

    // 未知模式回退模拟支付
    await mockPay(caseId, res.order.id)
    router.replace(`/user/chat/${caseId}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '支付失败，请稍后重试'
  } finally {
    paying.value = false
  }
}

function cancelQr(): void {
  stopPolling()
  qrModal.value = false
}

onMounted(load)
onUnmounted(stopPolling)
</script>

<template>
  <div class="page">
    <header class="page-header">
      <button type="button" class="back-btn" @click="router.push('/user/home')">← 返回</button>
      <h1>支付咨询费</h1>
    </header>

    <div v-if="loading" class="center-card">加载中…</div>

    <div v-else-if="caseInfo" class="pay-card">
      <section class="pay-summary">
        <p class="summary-label">案件号：{{ caseInfo.id }}</p>
        <p class="summary-desc">{{ caseInfo.platforms.join('、') }} · {{ caseInfo.description }}</p>
      </section>

      <section class="pay-amount">
        <span class="currency">¥</span>
        <span class="amount">{{ (caseInfo.amountCents / 100).toFixed(2) }}</span>
      </section>

      <p v-if="error" class="form-error">{{ error }}</p>

      <div class="pay-methods">
        <button type="button" class="pay-btn wechat" :disabled="paying" @click="pay('WECHAT')">
          💚 微信支付
        </button>
        <button type="button" class="pay-btn alipay" :disabled="paying" @click="pay('ALIPAY')">
          💙 支付宝
        </button>
      </div>
      <p class="hint">
        点击支付方式后将弹出二维码，请使用手机扫码完成支付，支付成功后自动进入匹配页面
      </p>
      <button type="button" class="ghost-btn" @click="router.push('/user/home')">
        返回用户端首页
      </button>
    </div>

    <!-- 扫码支付弹窗 -->
    <div v-if="qrModal" class="qr-mask" @click.self="cancelQr">
      <div class="qr-box">
        <h3>{{ qrChannel === 'wechat' ? '微信扫码支付' : '支付宝扫码支付' }}</h3>
        <img :src="qrImg" class="qr-img" alt="支付二维码" />
        <p class="qr-tip">
          请使用{{ qrChannel === 'wechat' ? '微信' : '支付宝' }}扫码支付
          ¥{{ ((caseInfo?.amountCents ?? 0) / 100).toFixed(2) }} 元
        </p>
        <p class="qr-wait">支付成功后自动进入匹配页面…</p>
        <button type="button" class="ghost-btn" @click="cancelQr">取消支付</button>
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
  max-width: 480px;
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
  max-width: 480px;
  margin: 0 auto;
  padding: 40px;
  background: #ffffff;
  border-radius: 18px;
  text-align: center;
  color: #6b7280;
}

.pay-card {
  max-width: 480px;
  margin: 0 auto;
  padding: 32px;
  background: #ffffff;
  border-radius: 18px;
  border-top: 6px solid #1e40af;
  box-shadow: 0 12px 36px rgba(30, 64, 175, 0.12);
}

.pay-summary {
  padding-bottom: 20px;
  border-bottom: 1px dashed #e5eaf0;
}

.summary-label {
  margin: 0 0 6px;
  color: #9aa4b2;
  font-size: 12px;
}

.summary-desc {
  margin: 0;
  color: #4b5563;
  font-size: 14px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pay-amount {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  padding: 28px 0;
}

.currency {
  color: #1e40af;
  font-size: 22px;
  font-weight: 700;
}

.amount {
  color: #1e40af;
  font-size: 52px;
  font-weight: 800;
  line-height: 1;
}

.pay-methods {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pay-btn {
  height: 48px;
  border: none;
  border-radius: 12px;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.2s ease, transform 0.2s ease;
}

.pay-btn:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.pay-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.wechat {
  background: #07c160;
}

.alipay {
  background: #1e40af;
}

.ghost-btn {
  display: block;
  margin: 20px auto 0;
  padding: 10px 26px;
  border: 1px solid #bcd7f8;
  border-radius: 999px;
  background: #ffffff;
  color: #1e40af;
  font-size: 14px;
  cursor: pointer;
}

.qr-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(15, 23, 42, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.qr-box {
  width: min(340px, 92vw);
  padding: 28px 24px 22px;
  background: #ffffff;
  border-radius: 18px;
  text-align: center;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.3);
}

.qr-box h3 {
  margin: 0 0 16px;
  color: #1e40af;
  font-size: 18px;
}

.qr-img {
  width: 240px;
  height: 240px;
  border: 1px solid #eef1f5;
  border-radius: 12px;
}

.qr-tip {
  margin: 14px 0 4px;
  color: #1f2329;
  font-size: 14px;
  font-weight: 600;
}

.qr-wait {
  margin: 0 0 6px;
  color: #9aa4b2;
  font-size: 13px;
}
</style>
