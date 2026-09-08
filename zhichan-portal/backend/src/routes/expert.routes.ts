import { Router } from 'express'
import {
  confirmRead,
  endService,
  generateSolution,
  getRoom,
  getTask,
  listWorkOrders as listExpertWorkOrders,
  listTasks,
  uploadChatImage,
  uploadSolutionFile,
  updateWorkOrderStatus as updateExpertWorkOrderStatus,
} from '../controllers/expert.controller'
import { upload } from '../utils/upload'

const router = Router()

// 待办案件
router.get('/tasks', listTasks)
router.get('/tasks/:caseId', getTask)
router.get('/tasks/:caseId/room', getRoom)
router.post('/tasks/:caseId/room/image', upload.single('file'), uploadChatImage)
router.post('/tasks/:caseId/solution/file', upload.single('file'), uploadSolutionFile)
router.post('/tasks/:caseId/confirm-read', confirmRead)
router.post('/tasks/:caseId/solution', generateSolution)
router.post('/tasks/:caseId/end', endService)

// 工单（主动监督私信 / 被动投诉）
router.get('/work-orders', listExpertWorkOrders)
router.put('/work-orders/:workOrderId/status', updateExpertWorkOrderStatus)

export default router
