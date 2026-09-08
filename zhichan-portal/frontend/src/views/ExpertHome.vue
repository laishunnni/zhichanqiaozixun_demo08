<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  listExpertWorkOrders,
  updateExpertWorkOrderStatus,
  type ExpertWorkOrderDto,
} from '@/api/expert'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const workOrders = ref<ExpertWorkOrderDto[]>([])

const statusText: Record<string, string> = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  CLOSED: '已关闭',
}

async function loadWorkOrders(): Promise<void> {
  try {
    const { workOrders: list } = await listExpertWorkOrders()
    workOrders.value = list
  } catch {
    // 工单加载失败不阻塞页面
  }
}

async function setOrderStatus(
  order: ExpertWorkOrderDto,
  status: 'PROCESSING' | 'CLOSED',
): Promise<void> {
  try {
    await updateExpertWorkOrderStatus(order.id, status)
    await loadWorkOrders()
  } catch {
    // 忽略
  }
}

function logout(): void {
  auth.logout()
  router.push('/expert/login')
}

onMounted(loadWorkOrders)
</script>

<template>
  <div class="role-page" style="background: #eff6ff">
    <router-link class="corner-home" to="/">← 返回门户首页</router-link>
    <div class="role-title" style="color: #2563eb">🧑‍⚖️ 咨询专员端</div>
    <p class="role-subtitle">登录成功，欢迎回到知产桥</p>
    <section class="role-info">
      <p>专员编号：{{ auth.user?.loginId }}</p>
      <p>角色：{{ auth.user?.role }}</p>
    </section>
    <div class="role-actions">
      <button style="background: #2563eb; color: #fff" @click="router.push('/expert/tasks')">
        待办任务
      </button>
      <button style="background: #dbeafe; color: #2563eb" @click="router.push('/expert/change-password')">
        修改密码
      </button>
      <button style="background: #dbeafe; color: #2563eb" @click="logout">退出登录</button>
    </div>

    <section class="work-orders">
      <h3>我的工单（{{ workOrders.length }}）</h3>
      <p v-if="workOrders.length === 0" class="case-empty">暂无工单</p>
      <div v-else class="case-items">
        <div v-for="o in workOrders" :key="o.id" class="case-item">
          <div class="case-row">
            <span class="case-platforms">
              {{ o.type === 'COMPLAINT' ? '⚠️ 投诉' : '🛡️ 监督' }} · {{ o.title }}
            </span>
            <span class="case-status">{{ statusText[o.status] ?? o.status }}</span>
          </div>
          <p class="case-desc">
            {{ o.content }}<template v-if="o.suggestion">（建议：{{ o.suggestion }}）</template>
          </p>
          <div v-if="o.status !== 'CLOSED'" class="order-actions">
            <button type="button" @click="setOrderStatus(o, 'PROCESSING')">标记处理中</button>
            <button type="button" @click="setOrderStatus(o, 'CLOSED')">关闭</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.work-orders {
  width: min(560px, 100%);
  text-align: left;
}

.work-orders h3 {
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

.order-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.order-actions button {
  padding: 6px 14px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: #ffffff;
  color: #2563eb;
  font-size: 12px;
  cursor: pointer;
}
</style>
