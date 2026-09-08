import { io, type Socket } from 'socket.io-client'
import type { ChatMessageDto } from '@/api/cases'

/**
 * 聊天 WebSocket：
 * 连接时携带 JWT，事件：join_room / send_message / receive_message。
 */
export function createChatSocket(token: string): Socket {
  return io('/', {
    auth: { token },
    autoConnect: true,
    transports: ['websocket', 'polling'],
  })
}

export function joinRoom(socket: Socket, roomId: string): void {
  socket.emit('join_room', { roomId })
}

export function sendMessage(
  socket: Socket,
  roomId: string,
  content: string,
  type: 'text' | 'image' = 'text',
): void {
  socket.emit('send_message', { roomId, content, type })
}

export function onReceiveMessage(socket: Socket, handler: (msg: ChatMessageDto) => void): void {
  socket.on('receive_message', handler)
}

export function emitConfirmRead(socket: Socket, caseId: string): void {
  socket.emit('confirm_read', { caseId })
}

export function emitGenerateSolution(socket: Socket, caseId: string): void {
  socket.emit('generate_solution', { caseId })
}

export function emitEndService(socket: Socket, caseId: string): void {
  socket.emit('end_service', { caseId })
}

export function onExpertReady(
  socket: Socket,
  handler: (data: { caseId: string }) => void,
): void {
  socket.on('expert_ready', handler)
}

export function onSolutionReady(
  socket: Socket,
  handler: (data: { caseId: string; url: string }) => void,
): void {
  socket.on('solution_ready', handler)
}

export function onServiceEnded(
  socket: Socket,
  handler: (data: { caseId: string }) => void,
): void {
  socket.on('service_ended', handler)
}
