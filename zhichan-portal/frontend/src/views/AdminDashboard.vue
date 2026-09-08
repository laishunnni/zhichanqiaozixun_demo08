<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as echarts from 'echarts'
import { getDashboard, type DashboardDto } from '@/api/admin'

const data = ref<DashboardDto | null>(null)
const error = ref('')
const loading = ref(true)
let charts: echarts.ECharts[] = []

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    data.value = await getDashboard()
    await nextTick()
    renderCharts()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function renderCharts(): void {
  charts.forEach((c) => c.dispose())
  charts = []
  if (!data.value) return

  const avgEl = document.getElementById('chartAvg')
  const complaintEl = document.getElementById('chartComplaint')
  const statusEl = document.getElementById('chartStatus')
  if (!avgEl || !complaintEl || !statusEl) return

  const expertNames = data.value.expertStats.map((e) => e.loginId)
  const avgChart = echarts.init(avgEl)
  avgChart.setOption({
    title: { text: '各专员平均分' },
    tooltip: {},
    xAxis: { type: 'category', data: expertNames },
    yAxis: { type: 'value', max: 5 },
    series: [
      {
        type: 'bar',
        data: data.value.expertStats.map((e) => e.avgScore),
        itemStyle: { color: '#3b82f6' },
      },
    ],
  })
  charts.push(avgChart)

  const complaintChart = echarts.init(complaintEl)
  complaintChart.setOption({
    title: { text: '各专员投诉次数' },
    tooltip: {},
    xAxis: { type: 'category', data: expertNames },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: data.value.expertStats.map((e) => e.complaintCount),
        itemStyle: { color: '#2563eb' },
      },
    ],
  })
  charts.push(complaintChart)

  const statusChart = echarts.init(statusEl)
  statusChart.setOption({
    title: { text: '案例状态分布' },
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['35%', '65%'],
        data: data.value.caseStatusDistribution.map((g) => ({
          name: g.status,
          value: g.count,
        })),
      },
    ],
  })
  charts.push(statusChart)
}

const statusText: Record<string, string> = {
  PENDING_REVIEW: '审核中',
  APPROVED: '待支付',
  PAID: '已支付',
  MATCHING: '匹配中',
  READY_TO_CHAT: '沟通中',
  COMPLETED: '已完成',
  REJECTED: '未通过',
}

onMounted(load)
onBeforeUnmount(() => charts.forEach((c) => c.dispose()))
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1>数据看板</h1>
      <p class="sub">各专员平均分、投诉次数与案例档位分布（ECharts）</p>
    </header>

    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="loading" class="empty-text">加载中…</p>

    <div v-if="data" class="cards">
      <div class="stat-card">
        <p class="stat-num">{{ data.expertStats.length }}</p>
        <p class="stat-label">专员数量</p>
      </div>
      <div class="stat-card">
        <p class="stat-num">{{ data.totalComplaints }}</p>
        <p class="stat-label">投诉工单</p>
      </div>
      <div class="stat-card">
        <p class="stat-num">
          {{ data.expertStats.length ? (data.expertStats.reduce((s, e) => s + e.avgScore, 0) / data.expertStats.length).toFixed(1) : '0' }}
        </p>
        <p class="stat-label">专员平均分</p>
      </div>
    </div>

    <div v-if="data" class="charts">
      <div id="chartAvg" class="chart"></div>
      <div id="chartComplaint" class="chart"></div>
      <div id="chartStatus" class="chart"></div>
    </div>

    <div v-if="data" class="legend">
      <span v-for="g in data.caseStatusDistribution" :key="g.status" class="legend-item">
        {{ statusText[g.status] ?? g.status }}：{{ g.count }}
      </span>
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

.empty-text {
  color: #9aa4b2;
  text-align: center;
}

.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.stat-card {
  padding: 20px;
  background: #ffffff;
  border-radius: 14px;
  border-top: 4px solid #3b82f6;
  text-align: center;
}

.stat-num {
  margin: 0;
  font-size: 32px;
  font-weight: 800;
  color: #3b82f6;
}

.stat-label {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.charts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.chart {
  height: 300px;
  padding: 12px;
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(31, 35, 41, 0.06);
}

.chart:last-child {
  grid-column: 1 / -1;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.legend-item {
  padding: 6px 14px;
  border-radius: 999px;
  background: #ffffff;
  color: #3b82f6;
  font-size: 13px;
}

@media (max-width: 768px) {
  .cards,
  .charts {
    grid-template-columns: 1fr;
  }
}
</style>
