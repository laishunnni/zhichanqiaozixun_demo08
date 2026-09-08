import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { asyncHandler } from '../utils/asyncHandler'

export const getRoom = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId
  const caseId = req.params.caseId
  if (!userId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }

  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, userId },
    include: {
      chatRoom: {
        include: {
          expert: { select: { id: true, loginId: true } },
          messages: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })
  if (!caseRecord) {
    res.status(404).json({ message: '案件不存在' })
    return
  }

  res.json({ case: caseRecord, room: caseRecord.chatRoom ?? null })
})

export const uploadChatImage = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId
  const caseId = req.params.caseId
  if (!userId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }
  if (!req.file) {
    res.status(400).json({ message: '请选择要上传的图片' })
    return
  }

  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, userId },
    include: { chatRoom: true },
  })
  if (!caseRecord || !caseRecord.chatRoom) {
    res.status(400).json({ message: '聊天房间不存在，请先完成支付与匹配' })
    return
  }

  res.status(201).json({ url: `/uploads/${req.file.filename}` })
})
