import { io, type Socket } from 'socket.io-client'

/**
 * Socket.io 预留：
 * 后续用于案件咨询、会话消息等实时推送。
 * 连接时携带 JWT，后端在 socket 中间件中校验。
 */
export function createSocket(token: string): Socket {
  return io('/', {
    auth: { token },
    autoConnect: false,
  })
}
