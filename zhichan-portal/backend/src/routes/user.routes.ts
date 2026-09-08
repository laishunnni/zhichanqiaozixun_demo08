import { Router } from 'express'
import {
  createCase,
  getCase,
  getMatchStatus,
  listMyCases,
  rateCase,
  requestMatch,
  uploadEvidence,
} from '../controllers/case.controller'
import { createOrder, mockPay } from '../controllers/pay.controller'
import { getRoom, uploadChatImage } from '../controllers/chat.controller'
import { upload } from '../utils/upload'

const router = Router()

// 案件
router.get('/cases', listMyCases)
router.post('/cases', createCase)
router.get('/cases/:caseId', getCase)
router.post('/cases/:caseId/evidence', upload.single('file'), uploadEvidence)

// 支付
router.post('/cases/:caseId/orders', createOrder)
router.post('/cases/:caseId/pay/mock', mockPay)
router.post('/cases/:caseId/rating', rateCase)

// 匹配
router.post('/cases/:caseId/match', requestMatch)
router.get('/cases/:caseId/match', getMatchStatus)

// 聊天
router.get('/cases/:caseId/room', getRoom)
router.post('/cases/:caseId/room/image', upload.single('file'), uploadChatImage)

export default router
