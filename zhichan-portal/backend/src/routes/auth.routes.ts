import { Router } from 'express'
import {
  changePassword,
  forgotPassword,
  getWechatLoginUrl,
  login,
  me,
  register,
  resetPassword,
  wechatCallback,
} from '../controllers/auth.controller'
import { authenticate } from '../middleware/auth'

const router = Router()

router.post('/login', login)
router.post('/register', register)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.get('/wechat/url', getWechatLoginUrl)
router.get('/wechat/callback', wechatCallback)
router.put('/password', authenticate, changePassword)
router.get('/me', authenticate, me)

export default router
