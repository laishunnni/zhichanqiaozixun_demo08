import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const uploadDir = path.resolve(currentDir, '../../uploads')

fs.mkdirSync(uploadDir, { recursive: true })

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`)
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('仅支持 jpg/png/pdf/docx 格式'))
    }
  },
})
