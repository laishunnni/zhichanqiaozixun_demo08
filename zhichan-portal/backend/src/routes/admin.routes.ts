import { Router } from 'express'
import {
  createExpert,
  createSupervision,
  dashboard,
  deleteExpert,
  getCase,
  getRecord,
  importExperts,
  listCases,
  listExperts,
  listRecords,
  listShifts,
  listWorkOrders,
  reviewCase,
  updateExpert,
  updateWorkOrderStatus,
  upsertShift,
} from '../controllers/admin.controller'
import { upload } from '../utils/upload'

const router = Router()

// 材料审核
router.get('/cases', listCases)
router.get('/cases/:caseId', getCase)
router.post('/cases/:caseId/review', reviewCase)

// 排班与专员管理
router.get('/experts', listExperts)
router.post('/experts', createExpert)
router.post('/experts/import', upload.single('file'), importExperts)
router.put('/experts/:expertId', updateExpert)
router.delete('/experts/:expertId', deleteExpert)
router.get('/shifts', listShifts)
router.post('/shifts', upsertShift)

// 全程监控与记录
router.get('/records', listRecords)
router.get('/records/:caseId', getRecord)

// 质量监管（主动监督评级 + 工单流转）
router.post('/records/:caseId/supervision', createSupervision)
router.get('/work-orders', listWorkOrders)
router.put('/work-orders/:workOrderId/status', updateWorkOrderStatus)

// 数据看板
router.get('/dashboard', dashboard)

export default router
