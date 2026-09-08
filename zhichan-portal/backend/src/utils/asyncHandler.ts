import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { ApiError } from './api-error'

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

export function asyncHandler(fn: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => {
      if (err instanceof ApiError) {
        res.status(err.status).json({ message: err.message })
        return
      }
      next(err)
    })
  }
}
