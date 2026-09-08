import { request } from './http'

export type CaseStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'PAID'
  | 'MATCHING'
  | 'READY_TO_CHAT'
  | 'IN_COMMUNICATION'
  | 'COMPLETED'
  | 'REJECTED'

export interface EvidenceDto {
  id: string
  fileName: string
  mimeType: string
  size: number
  url: string
}

export interface OrderDto {
  id: string
  amountCents: number
  method: string
  status: string
  paidAt?: string | null
}

export interface ChatSenderDto {
  id: string
  loginId: string
  role: string
}

export interface ChatMessageDto {
  id: string
  roomId: string
  senderId: string
  content: string
  type: string
  createdAt: string
  sender?: ChatSenderDto
}

export interface ChatRoomDto {
  id: string
  expertId: string
  expert?: { id: string; loginId: string } | null
  messages?: ChatMessageDto[]
  createdAt: string
}

export interface CaseDto {
  id: string
  status: CaseStatus
  platforms: string[]
  otherPlatform?: string | null
  description: string
  amountCents: number
  rejectReason?: string | null
  user?: { id: string; loginId: string; phone?: string | null; email?: string | null } | null
  evidences?: EvidenceDto[]
  order?: OrderDto | null
  rating?: RatingDto | null
  chatRoom?: ChatRoomDto | null
  createdAt: string
}

export interface RatingDto {
  id: string
  score: number
  feedback?: string | null
  createdAt: string
}

export interface CreateCasePayload {
  platforms: string[]
  otherPlatform?: string
  description: string
  contactPhone?: string
  contactEmail?: string
}

export function createCase(payload: CreateCasePayload) {
  return request<{ case: CaseDto }>('/user/cases', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listCases() {
  return request<{ cases: CaseDto[] }>('/user/cases')
}

export function getCase(caseId: string) {
  return request<{ case: CaseDto }>(`/user/cases/${caseId}`)
}

export function uploadEvidence(caseId: string, file: File) {
  const body = new FormData()
  body.append('file', file)
  return request<{ evidence: EvidenceDto }>(`/user/cases/${caseId}/evidence`, {
    method: 'POST',
    body,
  })
}

export function createOrder(caseId: string, method: 'WECHAT' | 'ALIPAY') {
  return request<{
    order: OrderDto
    amountYuan: string
    payment?: {
      mode: string
      channel?: string
      qrContent?: string
      redirectUrl?: string
      message?: string
    }
  }>(`/user/cases/${caseId}/orders`, {
    method: 'POST',
    body: JSON.stringify({ method }),
  })
}

export function mockPay(caseId: string, orderId: string) {
  return request<{ message: string; case: CaseDto; matched: boolean }>(
    `/user/cases/${caseId}/pay/mock`,
    {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    },
  )
}

export function requestMatch(caseId: string) {
  return request<{ case: CaseDto; matched: boolean }>(`/user/cases/${caseId}/match`, {
    method: 'POST',
  })
}

export function getMatchStatus(caseId: string) {
  return request<{ case: CaseDto }>(`/user/cases/${caseId}/match`)
}

export function getChatRoom(caseId: string) {
  return request<{ case: CaseDto; room: ChatRoomDto | null }>(`/user/cases/${caseId}/room`)
}

export function uploadChatImage(caseId: string, file: File) {
  const body = new FormData()
  body.append('file', file)
  return request<{ url: string }>(`/user/cases/${caseId}/room/image`, {
    method: 'POST',
    body,
  })
}

export function rateCase(caseId: string, score: number, feedback?: string) {
  return request<{ rating: RatingDto }>(`/user/cases/${caseId}/rating`, {
    method: 'POST',
    body: JSON.stringify({ score, feedback }),
  })
}
