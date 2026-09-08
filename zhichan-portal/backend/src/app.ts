import express from 'express'
import cors from 'cors'
import multer from 'multer'
import type { ErrorRequestHandler } from 'express'
import { env } from './config/env'
import { uploadDir } from './utils/upload'
import authRoutes from './routes/auth.routes'
import userRoutes from './routes/user.routes'
import expertRoutes from './routes/expert.routes'
import adminRoutes from './routes/admin.routes'
import payRoutes from './routes/pay.routes'
import { requireRole } from './middleware/role'

export function createApp() {
  const app = express()

  app.use(cors({ origin: env.frontendOrigin, credentials: true }))
  app.use(express.json())
  app.use(express.urlencoded({ extended: false }))
  app.use('/uploads', express.static(uploadDir))

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/pay', payRoutes)
  app.use('/api/user', requireRole('USER'), userRoutes)
  app.use('/api/expert', requireRole('EXPERT'), expertRoutes)
  app.use('/api/admin', requireRole('ADMIN'), adminRoutes)

  app.use((_req, res) => {
    res.status(404).json({ message: '接口不存在' })
  })

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({
        message: err.code === 'LIMIT_FILE_SIZE' ? '文件不能超过 10MB' : `上传失败：${err.message}`,
      })
      return
    }
    if (err instanceof Error && (err.message.includes('仅支持') || err.message.includes('格式'))) {
      res.status(400).json({ message: err.message })
      return
    }
    console.error('[error]', err)
    res.status(500).json({ message: '服务器内部错误' })
  }
  app.use(errorHandler)

  return app
}
