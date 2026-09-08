import type { Request, Response } from 'express'
import fs from 'node:fs'
import type {
  CaseStatus,
  Prisma,
  ShiftPeriod,
  SupervisionGrade,
  WorkOrderStatus,
} from '@prisma/client'
import { prisma } from '../lib/prisma'
import { getIo } from '../lib/io'
import { hashPassword } from '../utils/password'
import { asyncHandler } from '../utils/asyncHandler'
import * as XLSX from 'xlsx'

/* ===== 材料审核 ===== */
export const listCases = asyncHandler(async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? (req.query.status as CaseStatus) : undefined
  const cases = await prisma.case.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, loginId: true, phone: true, email: true } },
      evidences: true,
    },
  })
  res.json({ cases })
})

export const getCase = asyncHandler(async (req: Request, res: Response) => {
  const caseRecord = await prisma.case.findUnique({
    where: { id: req.params.caseId },
    include: {
      user: { select: { id: true, loginId: true, phone: true, email: true } },
      evidences: true,
      chatRoom: {
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            include: { sender: { select: { id: true, loginId: true, role: true } } },
          },
        },
      },
      rating: true,
      workOrders: { include: { expert: { select: { id: true, loginId: true } } } },
    },
  })
  if (!caseRecord) {
    res.status(404).json({ message: '案件不存在' })
    return
  }
  res.json({ case: caseRecord })
})

export const reviewCase = asyncHandler(async (req: Request, res: Response) => {
  const adminId = req.userId
  const caseId = req.params.caseId
  if (!adminId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }

  const approved = req.body?.approved === true
  const rejectReason =
    typeof req.body?.rejectReason === 'string' ? req.body.rejectReason.trim() : ''

  const caseRecord = await prisma.case.findUnique({ where: { id: caseId } })
  if (!caseRecord) {
    res.status(404).json({ message: '案件不存在' })
    return
  }
  if (caseRecord.status !== 'PENDING_REVIEW') {
    res.status(400).json({ message: '该案件已审核过' })
    return
  }
  if (!approved && !rejectReason) {
    res.status(400).json({ message: '驳回时必须填写理由' })
    return
  }

  const updated = await prisma.case.update({
    where: { id: caseId },
    data: {
      status: approved ? 'APPROVED' : 'REJECTED',
      rejectReason: approved ? null : rejectReason,
    },
  })

  // 通知用户端（用户提交页通过轮询获取最新状态）
  getIo()?.emit('case_reviewed', { caseId, status: updated.status, rejectReason: updated.rejectReason })
  res.json({ case: updated })
})

/* ===== 排班与专员管理 ===== */
export const listExperts = asyncHandler(async (_req: Request, res: Response) => {
  const experts = await prisma.user.findMany({
    where: { role: 'EXPERT' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      loginId: true,
      isActive: true,
      createdAt: true,
      _count: { select: { assignedCases: true } },
    },
  })
  res.json({ experts })
})

export const createExpert = asyncHandler(async (req: Request, res: Response) => {
  const { loginId, password } = req.body as { loginId?: unknown; password?: unknown }
  const id = typeof loginId === 'string' ? loginId.trim() : ''
  const pwd = typeof password === 'string' ? password : ''
  if (!id || pwd.length < 6) {
    res.status(400).json({ message: '请提供专员编号和至少 6 位初始密码' })
    return
  }
  const exists = await prisma.user.findUnique({ where: { loginId: id } })
  if (exists) {
    res.status(409).json({ message: '该专员编号已存在' })
    return
  }
  const expert = await prisma.user.create({
    data: { role: 'EXPERT', loginId: id, passwordHash: await hashPassword(pwd), mustChangePassword: true },
  })
  res.status(201).json({ expert })
})

export const updateExpert = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = req.body as { isActive?: unknown }
  const expert = await prisma.user.update({
    where: { id: req.params.expertId },
    data: { isActive: typeof isActive === 'boolean' ? isActive : undefined },
  })
  res.json({ expert })
})

export const deleteExpert = asyncHandler(async (req: Request, res: Response) => {
  // 软删除：置为停用，保留历史案件与记录
  await prisma.user.update({
    where: { id: req.params.expertId },
    data: { isActive: false },
  })
  res.json({ message: '专员已停用' })
})

const PERIOD_HEADERS: { period: ShiftPeriod; keyword: string; headers: string[] }[] = [
  { period: 'MORNING', keyword: '上午', headers: ['上午', 'AM', 'Morning'] },
  { period: 'AFTERNOON', keyword: '下午', headers: ['下午', 'PM', 'Afternoon'] },
  { period: 'EVENING', keyword: '晚上', headers: ['晚上', '夜班', 'EVENING', 'Evening'] },
]

const DUTY_FALSE = new Set(['×', '✗', '否', '0', 'false', 'no', 'n', '无', '休', '-', '—'])

/**
 * 导入排班 Excel：
 * 表头需包含“专员编号/专员号/专员”、“日期”，以及“上午/下午/晚上”值班列
 * （支持“上午（9：00-11：00）”这类带时间段的表头）；
 * 单元格非空且不是“×/否/0”等明确不值班标记（√/✔/✓/☑ 等任意勾选写法）即视为值班中，
 * 空白表示不值班（导入以表格为准）。
 * 专员编号匹配系统账号，不存在则自动创建（初始密码 123456，首次登录改密）。
 */
export const importExperts = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: '请选择 Excel 文件' })
    return
  }

  const workbook = XLSX.read(fs.readFileSync(req.file.path), { type: 'buffer' })
  // 优先选择包含“日期+专员”表头的工作表
  let sheet: XLSX.WorkSheet | undefined
  for (const name of workbook.SheetNames) {
    const candidate = workbook.Sheets[name]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(candidate, { defval: '', raw: false })
    const hasHeader = rows.some(
      (r) =>
        Object.keys(r).some((k) => k.includes('日期')) &&
        Object.keys(r).some((k) => k.includes('专员')),
    )
    if (hasHeader) {
      sheet = candidate
      break
    }
  }
  if (!sheet) {
    sheet = workbook.Sheets[workbook.SheetNames[0]]
  }
  if (!sheet) {
    res.status(400).json({ message: 'Excel 中没有工作表' })
    return
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })

  let created = 0
  let updated = 0
  let shiftsSet = 0
  const errors: string[] = []

  for (const row of rows) {
    const loginId = String(
      row['专员编号'] ?? row['专员号'] ?? row['专员'] ?? row['编号'] ?? '',
    ).trim()
    let date = String(row['日期'] ?? row['date'] ?? '').trim()
    // 月.日（如 8.1、8.11）→ 今年-月-日
    const md = date.match(/^(\d{1,2})\.(\d{1,2})$/)
    if (md) {
      const mon = Number(md[1])
      const day = Number(md[2])
      if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
        const now = new Date()
        date = `${now.getFullYear()}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
    }
    if (!loginId || !date) {
      errors.push(`缺少专员编号或日期：${JSON.stringify(row)}`)
      continue
    }

    let expert = await prisma.user.findUnique({ where: { loginId } })
    if (expert) {
      if (expert.role !== 'EXPERT') {
        errors.push(`${loginId} 不是专员账号，已跳过`)
        continue
      }
      updated++
    } else {
      expert = await prisma.user.create({
        data: {
          role: 'EXPERT',
          loginId,
          passwordHash: await hashPassword('123456'),
          mustChangePassword: true,
        },
      })
      created++
    }

    for (const p of PERIOD_HEADERS) {
      let value = ''
      for (const h of p.headers) {
        const raw = row[h]
        if (raw !== undefined && raw !== '') {
          value = String(raw).trim()
          break
        }
      }
      if (!value) {
        const matchedKey = Object.keys(row).find((k) => k.includes(p.keyword))
        if (matchedKey !== undefined && row[matchedKey] !== undefined && row[matchedKey] !== '') {
          value = String(row[matchedKey]).trim()
        }
      }
      const clean = value.replace(/[\s\u00A0\u3000]+/g, '').toLowerCase()
      const on = value !== '' && !DUTY_FALSE.has(value) && !DUTY_FALSE.has(clean)
      await prisma.expertShift.upsert({
        where: { expertId_date_period: { expertId: expert.id, date, period: p.period } },
        update: { isOnDuty: on },
        create: { expertId: expert.id, date, period: p.period, isOnDuty: on },
      })
      shiftsSet++
    }
  }

  res.json({ total: rows.length, created, updated, shiftsSet, errors })
})

export const listShifts = asyncHandler(async (req: Request, res: Response) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined
  const shifts = await prisma.expertShift.findMany({
    where: date ? { date } : undefined,
    orderBy: [{ date: 'desc' }, { period: 'asc' }],
    include: { expert: { select: { id: true, loginId: true, isActive: true } } },
  })
  res.json({ shifts })
})

export const upsertShift = asyncHandler(async (req: Request, res: Response) => {
  const { expertId, date, period, isOnDuty } = req.body as {
    expertId?: unknown
    date?: unknown
    period?: unknown
    isOnDuty?: unknown
  }
  const expert = typeof expertId === 'string' ? expertId : ''
  const day = typeof date === 'string' ? date : ''
  const pd = typeof period === 'string' ? (period as ShiftPeriod) : ''
  if (!expert || !day || !['MORNING', 'AFTERNOON', 'EVENING'].includes(pd)) {
    res.status(400).json({ message: '参数不完整' })
    return
  }
  const shift = await prisma.expertShift.upsert({
    where: { expertId_date_period: { expertId: expert, date: day, period: pd } },
    update: { isOnDuty: isOnDuty === true },
    create: { expertId: expert, date: day, period: pd, isOnDuty: isOnDuty === true },
  })
  res.json({ shift })
})

/* ===== 全程监控与记录 ===== */
export const listRecords = asyncHandler(async (req: Request, res: Response) => {
  const { caseId, expertId, from, to } = req.query as Record<string, string | undefined>
  const where: Prisma.CaseWhereInput = { status: 'COMPLETED' }
  if (caseId) {
    where.id = caseId
  }
  if (expertId) {
    where.expertId = expertId
  }
  if (from || to) {
    where.updatedAt = {
      gte: from ? new Date(from) : undefined,
      lte: to ? new Date(to) : undefined,
    }
  }

  const cases = await prisma.case.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      user: { select: { id: true, loginId: true } },
      expert: { select: { id: true, loginId: true } },
      rating: true,
      _count: { select: { workOrders: true } },
    },
  })
  res.json({ cases })
})

export const getRecord = asyncHandler(async (req: Request, res: Response) => {
  const caseRecord = await prisma.case.findUnique({
    where: { id: req.params.caseId },
    include: {
      user: { select: { id: true, loginId: true } },
      expert: { select: { id: true, loginId: true } },
      evidences: true,
      chatRoom: {
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            include: { sender: { select: { id: true, loginId: true, role: true } } },
          },
        },
      },
      rating: true,
      workOrders: { include: { expert: { select: { id: true, loginId: true } } } },
    },
  })
  if (!caseRecord) {
    res.status(404).json({ message: '案件不存在' })
    return
  }
  res.json({ case: caseRecord })
})

/* ===== 质量监管 ===== */
export const createSupervision = asyncHandler(async (req: Request, res: Response) => {
  const adminId = req.userId
  const caseId = req.params.caseId
  const { grade, content, suggestion } = req.body as {
    grade?: unknown
    content?: unknown
    suggestion?: unknown
  }
  if (!adminId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }
  const g = typeof grade === 'string' ? (grade as SupervisionGrade) : ''
  const text = typeof content === 'string' ? content.trim() : ''
  if (!['EXCELLENT', 'QUALIFIED', 'NEEDS_IMPROVEMENT'].includes(g)) {
    res.status(400).json({ message: '请选择评级' })
    return
  }
  if (!text) {
    res.status(400).json({ message: '请填写监督内容' })
    return
  }

  const caseRecord = await prisma.case.findUnique({ where: { id: caseId } })
  if (!caseRecord) {
    res.status(404).json({ message: '案件不存在' })
    return
  }
  if (!caseRecord.expertId) {
    res.status(400).json({ message: '该案件未分配专员' })
    return
  }

  const workOrder = await prisma.workOrder.create({
    data: {
      caseId,
      expertId: caseRecord.expertId,
      type: 'SUPERVISION',
      grade: g,
      title: '主动监督评级',
      content: text,
      suggestion: typeof suggestion === 'string' ? suggestion : null,
      createdBy: adminId,
    },
  })
  res.status(201).json({ workOrder })
})

export const listWorkOrders = asyncHandler(async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? (req.query.status as WorkOrderStatus) : undefined
  const workOrders = await prisma.workOrder.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      case: { select: { id: true } },
      expert: { select: { id: true, loginId: true } },
    },
  })
  res.json({ workOrders })
})

export const updateWorkOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const next = typeof req.body?.status === 'string' ? (req.body.status as WorkOrderStatus) : ''
  if (!['PENDING', 'PROCESSING', 'CLOSED'].includes(next)) {
    res.status(400).json({ message: '无效的工单状态' })
    return
  }
  const workOrder = await prisma.workOrder.findUnique({ where: { id: req.params.workOrderId } })
  if (!workOrder) {
    res.status(404).json({ message: '工单不存在' })
    return
  }
  if (workOrder.status === 'CLOSED' && next !== 'CLOSED') {
    res.status(400).json({ message: '已关闭工单不可再变更' })
    return
  }
  const updated = await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: { status: next, closedAt: next === 'CLOSED' ? new Date() : null },
  })
  res.json({ workOrder: updated })
})

/* ===== 数据看板 ===== */
export const dashboard = asyncHandler(async (_req: Request, res: Response) => {
  const [experts, ratings, complaints, statusGroups] = await Promise.all([
    prisma.user.findMany({ where: { role: 'EXPERT' }, select: { id: true, loginId: true } }),
    prisma.rating.findMany({ include: { case: { select: { expertId: true } } } }),
    prisma.workOrder.findMany({ where: { type: 'COMPLAINT' }, select: { expertId: true } }),
    prisma.case.groupBy({ by: ['status'], _count: { _all: true } }),
  ])

  const expertStats = experts.map((e) => {
    const rs = ratings.filter((r) => r.case.expertId === e.id)
    const avg = rs.length ? rs.reduce((sum, r) => sum + r.score, 0) / rs.length : 0
    return {
      expertId: e.id,
      loginId: e.loginId,
      avgScore: Number(avg.toFixed(1)),
      ratingCount: rs.length,
      complaintCount: complaints.filter((c) => c.expertId === e.id).length,
    }
  })

  res.json({
    caseStatusDistribution: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
    expertStats,
    totalComplaints: complaints.length,
  })
})
