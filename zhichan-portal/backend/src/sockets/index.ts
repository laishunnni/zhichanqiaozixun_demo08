import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { env } from '../config/env'
import { verifyToken, type TokenData } from '../lib/jwt'
import { prisma } from '../lib/prisma'
import { setIo } from '../lib/io'
import * as expertService from '../services/expert.service'

/**
 * Socket.io 预留：
 * 后续用于案件咨询、会话消息等实时推送，连接时校验 JWT。
 */
export function setupSocket(server: HttpServer): Server {
  const io = new Server(server, {
    cors: {
      origin: env.frontendOrigin,
      methods: ['GET', 'POST'],
    },
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) {
      next(new Error('unauthorized'))
      return
    }
    const data = verifyToken(token)
    if (!data) {
      next(new Error('unauthorized'))
      return
    }
    socket.data.user = data
    next()
  })

  io.on('connection', (socket) => {
    const user = socket.data.user as TokenData
    console.log(`[socket] connected: ${socket.id}`)

    socket.on(
      'confirm_read',
      async (payload: { caseId?: string }, ack?: (response: unknown) => void) => {
        try {
          const caseId = payload?.caseId
          if (!caseId) {
            ack?.({ ok: false, message: '缺少 caseId' })
            return
          }
          await expertService.confirmRead(caseId, user.userId)
          ack?.({ ok: true })
        } catch (err) {
          ack?.({ ok: false, message: err instanceof Error ? err.message : '服务器错误' })
        }
      },
    )

    socket.on(
      'generate_solution',
      async (payload: { caseId?: string }, ack?: (response: unknown) => void) => {
        try {
          const caseId = payload?.caseId
          if (!caseId) {
            ack?.({ ok: false, message: '缺少 caseId' })
            return
          }
          const result = await expertService.generateSolution(caseId, user.userId)
          ack?.({ ok: true, url: result.url })
        } catch (err) {
          ack?.({ ok: false, message: err instanceof Error ? err.message : '服务器错误' })
        }
      },
    )

    socket.on(
      'end_service',
      async (payload: { caseId?: string }, ack?: (response: unknown) => void) => {
        try {
          const caseId = payload?.caseId
          if (!caseId) {
            ack?.({ ok: false, message: '缺少 caseId' })
            return
          }
          await expertService.endService(caseId, user.userId)
          ack?.({ ok: true })
        } catch (err) {
          ack?.({ ok: false, message: err instanceof Error ? err.message : '服务器错误' })
        }
      },
    )

    socket.on(
      'join_room',
      async (payload: { roomId?: string }, ack?: (response: unknown) => void) => {
        try {
          const roomId = payload?.roomId
          if (!roomId) {
            ack?.({ ok: false, message: '缺少 roomId' })
            return
          }
          const room = await prisma.chatRoom.findUnique({
            where: { id: roomId },
            include: { case: true },
          })
          if (!room) {
            ack?.({ ok: false, message: '房间不存在' })
            return
          }
          if (room.case.status !== 'READY_TO_CHAT' && room.case.status !== 'IN_COMMUNICATION') {
            ack?.({ ok: false, message: '当前状态无法发送消息' })
            return
          }
          const isMember = room.expertId === user.userId || room.case.userId === user.userId
          if (!isMember) {
            ack?.({ ok: false, message: '无权加入该房间' })
            return
          }
          socket.join(roomId)
          ack?.({ ok: true })
        } catch (err) {
          console.error('[socket] join_room error', err)
          ack?.({ ok: false, message: '服务器错误' })
        }
      },
    )

    socket.on(
      'send_message',
      async (
        payload: { roomId?: string; content?: string; type?: string },
        ack?: (response: unknown) => void,
      ) => {
        try {
          const roomId = payload?.roomId
          const content = typeof payload?.content === 'string' ? payload.content.trim() : ''
          const type = payload?.type === 'image' ? 'image' : 'text'
          if (!roomId || !content) {
            ack?.({ ok: false, message: '消息内容不能为空' })
            return
          }
          const room = await prisma.chatRoom.findUnique({
            where: { id: roomId },
            include: { case: true },
          })
          if (!room) {
            ack?.({ ok: false, message: '房间不存在' })
            return
          }
          const isMember = room.expertId === user.userId || room.case.userId === user.userId
          if (!isMember) {
            ack?.({ ok: false, message: '无权发送消息' })
            return
          }

          const message = await prisma.chatMessage.create({
            data: { roomId, senderId: user.userId, content, type },
            include: {
              sender: { select: { id: true, loginId: true, role: true } },
            },
          })

          io.to(roomId).emit('receive_message', message)
          ack?.({ ok: true, message })
        } catch (err) {
          console.error('[socket] send_message error', err)
          ack?.({ ok: false, message: '服务器错误' })
        }
      },
    )

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`)
    })
  })

  setIo(io)
  return io
}
