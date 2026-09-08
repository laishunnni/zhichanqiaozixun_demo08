import type { Request, Response } from 'express'
import type { WorkOrderStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { asyncHandler } from '../utils/asyncHandler'
import * as expertService from '../services/expert.service'

export const listTasks = asyncHandler(async (req: Request, res: Response) => {
  const expertId = req.userId
  if (!expertId) {
    res.status(401).json({ message: '未登录' })
    return
  }

  const cases = await prisma.case.findMany({
    where: {
      expertId,
      status: { in: ['PAID', 'READY_TO_CHAT'] },
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      user: { select: { id: true, loginId: true, phone: true, email: true } },
      evidences: true,
    },
  })

  res.json({ cases })
})

export const getTask = asyncHandler(async (req: Request, res: Response) => {
  const expertId = req.userId
  const caseId = req.params.caseId
  if (!expertId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }

  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, expertId },
    include: {
      user: { select: { id: true, loginId: true, phone: true, email: true } },
      evidences: true,
      chatRoom: true,
    },
  })
  if (!caseRecord) {
    res.status(404).json({ message: '案件不存在或未分配给您' })
    return
  }

  res.json({ case: caseRecord })
})

export const getRoom = asyncHandler(async (req: Request, res: Response) => {
  const expertId = req.userId
  const caseId = req.params.caseId
  if (!expertId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }

  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, expertId },
    include: {
      evidences: true,
      user: { select: { id: true, loginId: true, phone: true, email: true } },
      chatRoom: {
        include: {
          expert: { select: { id: true, loginId: true } },
          messages: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })
  if (!caseRecord) {
    res.status(404).json({ message: '案件不存在或未分配给您' })
    return
  }

  res.json({ case: caseRecord, room: caseRecord.chatRoom ?? null })
})

export const confirmRead = asyncHandler(async (req: Request, res: Response) => {
  const expertId = req.userId
  const caseId = req.params.caseId
  if (!expertId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }
  const updated = await expertService.confirmRead(caseId, expertId)
  res.json({ case: updated, message: '已确认阅读完毕，双方进入可聊天状态' })
})

export const generateSolution = asyncHandler(async (req: Request, res: Response) => {
  const expertId = req.userId
  const caseId = req.params.caseId
  if (!expertId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }
  const result = await expertService.generateSolution(caseId, expertId)
  res.status(201).json({ url: result.url, message: result.message })
})

export const endService = asyncHandler(async (req: Request, res: Response) => {
  const expertId = req.userId
  const caseId = req.params.caseId
  if (!expertId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }
  const updated = await expertService.endService(caseId, expertId)
  res.json({ case: updated, message: '服务已结束' })
})

export const uploadChatImage = asyncHandler(async (req: Request, res: Response) => {
  const expertId = req.userId
  const caseId = req.params.caseId
  if (!expertId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }
  if (!req.file) {
    res.status(400).json({ message: '请选择要上传的图片' })
    return
  }

  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, expertId },
    include: { chatRoom: true },
  })
  if (!caseRecord || !caseRecord.chatRoom) {
    res.status(400).json({ message: '聊天房间不存在' })
    return
  }

  res.status(201).json({ url: `/uploads/${req.file.filename}` })
})

export const uploadSolutionFile = asyncHandler(async (req: Request, res: Response) => {
  const expertId = req.userId
  const caseId = req.params.caseId
  if (!expertId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }
  if (!req.file) {
    res.status(400).json({ message: '请选择要上传的解决方案文件' })
    return
  }

  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, expertId },
    include: { chatRoom: true },
  })
  if (!caseRecord || !caseRecord.chatRoom) {
    res.status(400).json({ message: '聊天房间不存在' })
    return
  }
  if (caseRecord.status !== 'READY_TO_CHAT') {
    res.status(400).json({ message: '请先确认阅读完毕' })
    return
  }

  const url = `/uploads/${req.file.filename}`
  const message = await prisma.chatMessage.create({
    data: {
      roomId: caseRecord.chatRoom.id,
      senderId: expertId,
      content: url,
      type: 'solution',
    },
    include: {
      sender: { select: { id: true, loginId: true, role: true } },
    },
  })

  getIo()?.to(caseRecord.chatRoom.id).emit('receive_message', message)
  getIo()?.to(caseRecord.chatRoom.id).emit('solution_ready', { caseId, url })

  res.status(201).json({ url, message })
})

export const listWorkOrders = asyncHandler(async (req: Request, res: Response) => {
  const expertId = req.userId
  if (!expertId) {
    res.status(401).json({ message: '未登录' })
    return
  }
  const workOrders = await prisma.workOrder.findMany({
    where: { expertId },
    orderBy: { createdAt: 'desc' },
    include: { case: { select: { id: true, status: true } } },
  })
  res.json({ workOrders })
})

export const updateWorkOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const expertId = req.userId
  const next = typeof req.body?.status === 'string' ? (req.body.status as WorkOrderStatus) : ''
  if (!expertId) {
    res.status(401).json({ message: '未登录' })
    return
  }
  if (!['PROCESSING', 'CLOSED'].includes(next)) {
    res.status(400).json({ message: '专员仅可标记处理中或关闭' })
    return
  }
  const workOrder = await prisma.workOrder.findFirst({ where: { id: req.params.workOrderId, expertId } })
  if (!workOrder) {
    res.status(404).json({ message: '工单不存在' })
    return
  }
  const updated = await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: { status: next, closedAt: next === 'CLOSED' ? new Date() : null },
  })
  res.json({ workOrder: updated })
})
