<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  createExpert,
  deleteExpert,
  importExperts,
  listExperts,
  listShifts,
  updateExpert,
  upsertShift,
  type ExpertDto,
  type ShiftDto,
  type ShiftPeriod,
} from '@/api/admin'

const PERIODS: { key: ShiftPeriod; label: string }[] = [
  { key: 'MORNING', label: '上午（8:30-11:30）' },
  { key: 'AFTERNOON', label: '下午（13:30-17:30）' },
  { key: 'EVENING', label: '晚上（20:00-22:00）' },
]

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const date = ref(today())
const experts = ref<ExpertDto[]>([])
const shifts = ref<ShiftDto[]>([])
const loading = ref(true)
const error = ref('')
const addOpen = ref(false)
const importResult = ref('')
const importError = ref('')
const addForm = reactive({ loginId: '', password: '' })
const submitting = ref(false)

const shiftMap = computed(() => {
  const map: Record<string, boolean> = {}
  for (const s of shifts.value) {
    map[`${s.expertId}:${s.period}`] = s.isOnDuty
  }
  return map
})

function isOnDuty(expertId: string, period: ShiftPeriod): boolean {
  return shiftMap.value[`${expertId}:${period}`] ?? false
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const [expertRes, shiftRes] = await Promise.all([listExperts(), listShifts(date.value)])
    experts.value = expertRes.experts
    shifts.value = shiftRes.shifts
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function toggleDuty(expertId: string, period: ShiftPeriod): Promise<void> {
  error.value = ''
  try {
    await upsertShift({
      expertId,
      date: date.value,
      period,
      isOnDuty: !isOnDuty(expertId, period),
    })
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败'
  }
}

async function toggleActive(expert: ExpertDto): Promise<void> {
  try {
    await updateExpert(expert.id, { isActive: !expert.isActive })
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败'
  }
}

async function removeExpert(expert: ExpertDto): Promise<void> {
  if (!window.confirm(`确认停用专员 ${expert.loginId}？`)) return
  try {
    await deleteExpert(expert.id)
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '操作失败'
  }
}

async function addExpert(): Promise<void> {
  error.value = ''
  if (!addForm.loginId.trim() || addForm.password.length < 6) {
    error.value = '请填写专员编号和至少 6 位初始密码'
    return
  }
  submitting.value = true
  try {
    await createExpert(addForm.loginId.trim(), addForm.password)
    addOpen.value = false
    addForm.loginId = ''
    addForm.password = ''
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败'
  } finally {
    submitting.value = false
  }
}

async function onImport(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  importResult.value = ''
  importError.value = ''
  try {
    const res = await importExperts(file)
    const errText = res.errors.length
      ? `，跳过 ${res.errors.length} 条（${res.errors.slice(0, 3).join('；')}）`
      : ''
    importResult.value = `导入完成：新增专员 ${res.created} 名，更新 ${res.updated} 名，设置值班 ${res.shiftsSet} 项${errText}`
    await load()
  } catch (e) {
    importError.value = e instanceof Error ? e.message : '导入失败'
  } finally {
    target.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="page-header">
      <h1>排班与专员管理</h1>
      <p class="sub">匹配引擎仅从“值班中”且“无活跃聊天”的专员中分配</p>
    </header>

    <div class="toolbar">
      <label class="date-label">
        排班日期：
        <input v-model="date" type="date" class="date-input" @change="load" />
      </label>
      <div class="toolbar-actions">
        <input ref="importInput" type="file" accept=".xlsx,.xls,.csv" hidden @change="onImport" />
        <button type="button" class="add-btn" @click="importInput?.click()">📥 导入 Excel</button>
        <button type="button" class="add-btn ghost" @click="addOpen = !addOpen">＋ 新增专员</button>
      </div>
    </div>

    <p v-if="importResult" class="import-result ok">{{ importResult }}</p>
    <p v-if="importError" class="import-result err">{{ importError }}</p>
    <p class="hint">导入模板表头：日期 / 专员 / 上午（8:30-11:30）/ 下午（13:30-17:30）/ 晚上（20:00-22:00）；时间范围可自行调整，仅按“上午/下午/晚上”识别列；勾选符号（√/✔/✓/☑）表示值班中，空白或 ×/否/0 表示不值班；专员不存在时自动创建（初始密码 123456）</p>

    <div v-if="addOpen" class="add-card">
      <input v-model="addForm.loginId" class="text-input" type="text" placeholder="专员编号，如 ZX20260002" />
      <input v-model="addForm.password" class="text-input" type="password" placeholder="初始密码（至少 6 位）" />
      <button type="button" class="primary-btn" :disabled="submitting" @click="addExpert">
        {{ submitting ? '创建中…' : '创建专员' }}
      </button>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="loading" class="empty-text">加载中…</p>

    <div v-else class="schedule-card">
      <div class="schedule-head">
        <span class="col-expert">专员</span>
        <span v-for="p in PERIODS" :key="p.key" class="col-period">{{ p.label }}</span>
        <span class="col-actions">状态 / 操作</span>
      </div>
      <div v-for="expert in experts" :key="expert.id" class="schedule-row">
        <span class="col-expert">
          {{ expert.loginId }}
          <span v-if="!expert.isActive" class="offline-tag">停用</span>
        </span>
        <button
          v-for="p in PERIODS"
          :key="p.key"
          type="button"
          :title="p.label"
          class="period-btn"
          :class="{ on: isOnDuty(expert.id, p.key) }"
          @click="toggleDuty(expert.id, p.key)"
        >
          {{ isOnDuty(expert.id, p.key) ? '值班中' : '—' }}
        </button>
        <span class="col-actions">
          <button type="button" class="mini-btn" @click="toggleActive(expert)">
            {{ expert.isActive ? '停用' : '启用' }}
          </button>
          <button type="button" class="mini-btn danger" @click="removeExpert(expert)">删除</button>
        </span>
      </div>
      <p v-if="experts.length === 0" class="empty-text">暂无专员，请先新增</p>
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

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.date-label {
  font-size: 14px;
  color: #4b5563;
}

.date-input {
  padding: 6px 10px;
  border: 1px solid #d9dee5;
  border-radius: 8px;
  font-size: 14px;
}

.add-btn {
  padding: 9px 18px;
  border: none;
  border-radius: 999px;
  background: #3b82f6;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
}

.toolbar-actions {
  display: flex;
  gap: 10px;
}

.add-btn.ghost {
  background: #ffffff;
  border: 1px solid #dbeafe;
  color: #3b82f6;
}

.import-result {
  margin: 0 0 12px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
}

.import-result.ok {
  background: #f6ffed;
  color: #52c41a;
}

.import-result.err {
  background: #fff1f0;
  color: #f5222d;
}

.add-card {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  padding: 16px;
  background: #ffffff;
  border-radius: 12px;
  flex-wrap: wrap;
}

.text-input {
  flex: 1;
  min-width: 180px;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #d9dee5;
  border-radius: 8px;
  font-size: 14px;
}

.primary-btn {
  padding: 0 22px;
  border: none;
  border-radius: 999px;
  background: #3b82f6;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
}

.schedule-card {
  padding: 16px;
  background: #ffffff;
  border-radius: 18px;
  border-top: 6px solid #3b82f6;
  box-shadow: 0 12px 36px rgba(59, 130, 246, 0.1);
}

.schedule-head,
.schedule-row {
  display: grid;
  grid-template-columns: 1.2fr repeat(3, 1fr) 1.4fr;
  gap: 10px;
  align-items: center;
}

.schedule-head {
  padding: 8px 10px;
  color: #9aa4b2;
  font-size: 12px;
}

.schedule-row {
  padding: 10px;
  border-top: 1px solid #f4f4f8;
  font-size: 14px;
}

.col-expert {
  font-weight: 600;
}

.offline-tag {
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: #fff1f0;
  color: #f5222d;
  font-size: 11px;
}

.period-btn {
  padding: 8px;
  border: 1px solid #e5e5ec;
  border-radius: 8px;
  background: #fafafa;
  color: #b0b8c4;
  font-size: 12px;
  cursor: pointer;
}

.period-btn.on {
  background: rgba(59, 130, 246, 0.1);
  border-color: #3b82f6;
  color: #3b82f6;
  font-weight: 600;
}

.col-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.mini-btn {
  padding: 5px 12px;
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

.empty-text {
  margin: 0;
  padding: 24px 0;
  color: #9aa4b2;
  text-align: center;
}
</style>
