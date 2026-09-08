import { Router } from 'express'
import {
  alipayNotify,
  epayNotify,
  wechatNotify,
  zpayNotify,
} from '../controllers/pay.controller'

const router = Router()

// 支付平台异步通知（公开接口，不做 JWT 校验，靠签名验签）
router.post('/alipay/notify', alipayNotify)
router.post('/wechat/notify', wechatNotify)
router.post('/epay/notify', epayNotify)
router.get('/epay/notify', epayNotify)
router.post('/zpay/notify', zpayNotify)
router.get('/zpay/notify', zpayNotify)

export default router
