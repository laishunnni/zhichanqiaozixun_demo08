import { prisma } from '../lib/prisma'
import type { ShiftPeriod } from '@prisma/client'
import { notifyMatched } from './notify.service'

export interface MatchResult {
  matched: boolean
  expertId?: string
  roomId?: string
}

/**
 * 匹配逻辑（先用 is_online 模拟排班）：
 * 从“今日值班中”且“当前无活跃聊天（PAID/READY_TO_CHAT）”的专员中分配，
 * 分配成功后创建聊天房间并写入 expertId，案件状态保持 PAID，
 * 等待专员“确认阅读完毕”后进入 READY_TO_CHAT；
 * 若无值班空闲专员则置为 MATCHING，进入排队等待。
 */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function currentPeriod(hour: number): ShiftPeriod {
  if (hour < 12) return 'MORNING'
  if (hour < 18) return 'AFTERNOON'
  return 'EVENING'
}

export async function tryAssignExpert(caseId: string): Promise<MatchResult> {
  const now = new Date()
  const onDutyShifts = await prisma.expertShift.findMany({
    where: { date: localDateStr(now), period: currentPeriod(now.getHours()), isOnDuty: true },
  })
  const onDutyIds = onDutyShifts.map((s) => s.expertId)

  if (onDutyIds.length === 0) {
    await prisma.case.update({
      where: { id: caseId },
      data: { status: 'MATCHING' },
    })
    return { matched: false }
  }

  const active = await prisma.case.findMany({
    where: {
      expertId: { in: onDutyIds },
      status: { in: ['PAID', 'READY_TO_CHAT'] },
    },
    select: { expertId: true },
  })
  const busyIds = new Set(active.map((c) => c.expertId))
  const candidates = onDutyIds.filter((id) => !busyIds.has(id))
  if (candidates.length === 0) {
    await prisma.case.update({
      where: { id: caseId },
      data: { status: 'MATCHING' },
    })
    return { matched: false }
  }

  const expert = await prisma.user.findFirst({
    where: { id: { in: candidates }, role: 'EXPERT', isActive: true },
    orderBy: { updatedAt: 'asc' },
  })
  if (!expert) {
    await prisma.case.update({
      where: { id: caseId },
      data: { status: 'MATCHING' },
    })
    return { matched: false }
  }

  const room = await prisma.$transaction(async (tx) => {
    const created = await tx.chatRoom.create({
      data: { caseId, expertId: expert.id },
    })
    await tx.case.update({
      where: { id: caseId },
      data: { expertId: expert.id },
    })
    return created
  })

  // 匹配成功：短信/邮件通知用户（通道未配置时静默跳过）
  await notifyMatched(caseId)

  return { matched: true, expertId: expert.id, roomId: room.id }
}
