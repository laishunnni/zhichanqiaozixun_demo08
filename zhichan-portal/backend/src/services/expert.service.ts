import { prisma } from '../lib/prisma'
import { getIo } from '../lib/io'
import { ApiError } from '../utils/api-error'
import { generateSolutionPdf } from './solution'

export async function confirmRead(caseId: string, expertId: string) {
  const caseRecord = await prisma.case.findFirst({ where: { id: caseId, expertId } })
  if (!caseRecord) {
    throw new ApiError(404, '案件不存在或未分配给您')
  }
  if (caseRecord.status !== 'PAID') {
    throw new ApiError(400, '当前状态无法确认阅读')
  }

  const updated = await prisma.case.update({
    where: { id: caseId },
    data: { status: 'READY_TO_CHAT' },
  })

  const room = await prisma.chatRoom.findUnique({ where: { caseId } })
  getIo()?.to(room?.id ?? '').emit('expert_ready', { caseId })

  return updated
}

export async function generateSolution(caseId: string, expertId: string) {
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, expertId },
    include: {
      user: { select: { id: true, loginId: true, phone: true, email: true } },
    },
  })
  if (!caseRecord) {
    throw new ApiError(404, '案件不存在或未分配给您')
  }
  if (caseRecord.status !== 'READY_TO_CHAT') {
    throw new ApiError(400, '请先确认阅读完毕')
  }

  const room = await prisma.chatRoom.findUnique({ where: { caseId } })
  if (!room) {
    throw new ApiError(400, '聊天房间不存在')
  }

  const expert = await prisma.user.findUnique({ where: { id: expertId } })
  const result = await generateSolutionPdf({
    caseId,
    userLoginId: caseRecord.user.loginId,
    expertLoginId: expert?.loginId ?? 'expert',
    platforms: caseRecord.platforms,
    otherPlatform: caseRecord.otherPlatform,
    description: caseRecord.description,
    contact: caseRecord.contactPhone || caseRecord.contactEmail || '',
  })

  const message = await prisma.chatMessage.create({
    data: {
      roomId: room.id,
      senderId: expertId,
      content: result.url,
      type: 'solution',
    },
    include: {
      sender: { select: { id: true, loginId: true, role: true } },
    },
  })

  getIo()?.to(room.id).emit('receive_message', message)
  getIo()?.to(room.id).emit('solution_ready', { caseId, url: result.url })

  return { url: result.url, message }
}

export async function endService(caseId: string, expertId: string) {
  const caseRecord = await prisma.case.findFirst({ where: { id: caseId, expertId } })
  if (!caseRecord) {
    throw new ApiError(404, '案件不存在或未分配给您')
  }
  if (caseRecord.status !== 'READY_TO_CHAT') {
    throw new ApiError(400, '当前状态无法结束服务')
  }

  const updated = await prisma.case.update({
    where: { id: caseId },
    data: { status: 'COMPLETED' },
  })

  const room = await prisma.chatRoom.findUnique({ where: { caseId } })
  getIo()?.to(room?.id ?? '').emit('service_ended', { caseId })

  return updated
}
