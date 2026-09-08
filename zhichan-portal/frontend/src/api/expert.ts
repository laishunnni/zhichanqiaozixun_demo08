import { request } from './http'
import type { CaseDto, ChatMessageDto, ChatRoomDto } from './cases'

export function listExpertTasks() {
  return request<{ cases: CaseDto[] }>('/expert/tasks')
}

export function getExpertTask(caseId: string) {
  return request<{ case: CaseDto }>(`/expert/tasks/${caseId}`)
}

export function getExpertRoom(caseId: string) {
  return request<{ case: CaseDto; room: ChatRoomDto | null }>(`/expert/tasks/${caseId}/room`)
}

export function confirmRead(caseId: string) {
  return request<{ case: CaseDto; message: string }>(
    `/expert/tasks/${caseId}/confirm-read`,
    { method: 'POST' },
  )
}

export function generateSolution(caseId: string) {
  return request<{ url: string; message: ChatMessageDto }>(
    `/expert/tasks/${caseId}/solution`,
    { method: 'POST' },
  )
}

export function endService(caseId: string) {
  return request<{ case: CaseDto; message: string }>(`/expert/tasks/${caseId}/end`, {
    method: 'POST',
  })
}

export function uploadExpertChatImage(caseId: string, file: File) {
  const body = new FormData()
  body.append('file', file)
  return request<{ url: string }>(`/expert/tasks/${caseId}/room/image`, {
    method: 'POST',
    body,
  })
}

export function uploadSolutionFile(caseId: string, file: File) {
  const body = new FormData()
  body.append('file', file)
  return request<{ url: string; message: ChatMessageDto }>(
    `/expert/tasks/${caseId}/solution/file`,
    {
      method: 'POST',
      body,
    },
  )
}

export interface ExpertWorkOrderDto {
  id: string
  caseId?: string | null
  type: 'SUPERVISION' | 'COMPLAINT'
  status: 'PENDING' | 'PROCESSING' | 'CLOSED'
  grade?: string | null
  title: string
  content: string
  suggestion?: string | null
  createdAt: string
  case?: { id: string; status: string } | null
}

export function listExpertWorkOrders() {
  return request<{ workOrders: ExpertWorkOrderDto[] }>('/expert/work-orders')
}

export function updateExpertWorkOrderStatus(id: string, status: 'PROCESSING' | 'CLOSED') {
  return request<{ workOrder: ExpertWorkOrderDto }>(`/expert/work-orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}
