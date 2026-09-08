import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { asyncHandler } from '../utils/asyncHandler'
import { tryAssignExpert } from '../services/matching'

export const createCase = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ message: '未登录' })
    return
  }

  const { platforms, otherPlatform, description, contactPhone, contactEmail } = req.body as {
    platforms?: unknown
    otherPlatform?: unknown
    description?: unknown
    contactPhone?: unknown
    contactEmail?: unknown
  }

  const platformList = Array.isArray(platforms)
    ? platforms.filter((p): p is string => typeof p === 'string')
    : []
  if (platformList.length === 0) {
    res.status(400).json({ message: '请选择至少一个侵权平台' })
    return
  }

  const other = typeof otherPlatform === 'string' ? otherPlatform.trim() : ''
  if (platformList.includes('其他') && !other) {
    res.status(400).json({ message: '请填写其他平台名称' })
    return
  }

  const desc = typeof description === 'string' ? description.trim() : ''
  if (desc.length < 20) {
    res.status(400).json({ message: '侵权描述至少 20 字' })
    return
  }

  const phone = typeof contactPhone === 'string' ? contactPhone.trim() : ''
  const email = typeof contactEmail === 'string' ? contactEmail.trim() : ''
  if (!phone && !email) {
    res.status(400).json({ message: '请填写手机号或邮箱联系方式（二选一）' })
    return
  }

  const data = await prisma.case.create({
    data: {
      userId,
      platforms: platformList,
      otherPlatform: platformList.includes('其他') ? other : null,
      description: desc,
      contactPhone: phone || null,
      contactEmail: email || null,
    },
  })

  res.status(201).json({ case: data })
})

export const listMyCases = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ message: '未登录' })
    return
  }

  const cases = await prisma.case.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { evidences: true, chatRoom: { include: { expert: { select: { id: true, loginId: true } } } } },
  })

  res.json({ cases })
})

export const getCase = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId
  const caseId = req.params.caseId
  if (!userId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }

  const data = await prisma.case.findFirst({
    where: { id: caseId, userId },
    include: {
      evidences: true,
      order: true,
      chatRoom: { include: { expert: { select: { id: true, loginId: true } } } },
    },
  })
  if (!data) {
    res.status(404).json({ message: '案件不存在' })
    return
  }

  res.json({ case: data })
})

export const uploadEvidence = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId
  const caseId = req.params.caseId
  if (!userId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }
  if (!req.file) {
    res.status(400).json({ message: '请选择要上传的文件' })
    return
  }

  const caseRecord = await prisma.case.findFirst({ where: { id: caseId, userId } })
  if (!caseRecord) {
    res.status(404).json({ message: '案件不存在' })
    return
  }

  const evidence = await prisma.evidence.create({
    data: {
      caseId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`,
    },
  })

  res.status(201).json({ evidence })
})

export const requestMatch = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId
  const caseId = req.params.caseId
  if (!userId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }

  const caseRecord = await prisma.case.findFirst({ where: { id: caseId, userId } })
  if (!caseRecord) {
    res.status(404).json({ message: '案件不存在' })
    return
  }
  if (caseRecord.status !== 'PAID' && caseRecord.status !== 'MATCHING') {
    res.status(400).json({ message: '当前状态无需匹配' })
    return
  }

  const result = await tryAssignExpert(caseId)
  const updated = await prisma.case.findUnique({ where: { id: caseId } })
  res.json({ case: updated, matched: result.matched })
})

export const getMatchStatus = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId
  const caseId = req.params.caseId
  if (!userId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }

  const data = await prisma.case.findFirst({
    where: { id: caseId, userId },
    include: { chatRoom: { include: { expert: { select: { id: true, loginId: true } } } } },
  })
  if (!data) {
    res.status(404).json({ message: '案件不存在' })
    return
  }

  res.json({ case: data })
})

export const rateCase = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId
  const caseId = req.params.caseId
  if (!userId || !caseId) {
    res.status(401).json({ message: '未登录' })
    return
  }

  const score = Number(req.body?.score)
  const feedback = typeof req.body?.feedback === 'string' ? req.body.feedback.trim() : ''
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    res.status(400).json({ message: '评分需为 1-5 星' })
    return
  }

  const caseRecord = await prisma.case.findFirst({ where: { id: caseId, userId } })
  if (!caseRecord) {
    res.status(404).json({ message: '案件不存在' })
    return
  }
  if (caseRecord.status !== 'COMPLETED') {
    res.status(400).json({ message: '案件完成后才能评分' })
    return
  }
  if (!caseRecord.expertId) {
    res.status(400).json({ message: '该案件未分配专员' })
    return
  }

  const rating = await prisma.rating.upsert({
    where: { caseId },
    update: { score, feedback: feedback || null },
    create: { caseId, userId, score, feedback: feedback || null },
  })

  // 被动监督：用户评分 <= 3 星时自动生成投诉工单
  if (score <= 3) {
    await prisma.workOrder.create({
      data: {
        caseId,
        expertId: caseRecord.expertId,
        type: 'COMPLAINT',
        title: '用户低分投诉',
        content: `用户评分 ${score} 星${feedback ? `：${feedback}` : ''}`,
        createdBy: userId,
      },
    })
  }

  res.status(201).json({ rating })
})
