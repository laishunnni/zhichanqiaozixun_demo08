import { request } from './http'
import type { CaseDto } from './cases'

export type ShiftPeriod = 'MORNING' | 'AFTERNOON' | 'EVENING'
export type WorkOrderStatus = 'PENDING' | 'PROCESSING' | 'CLOSED'
export type WorkOrderType = 'SUPERVISION' | 'COMPLAINT'

export interface ExpertDto {
  id: string
  loginId: string
  isActive: boolean
  createdAt: string
  _count?: { assignedCases: number }
}

export interface ShiftDto {
  id: string
  expertId: string
  date: string
  period: ShiftPeriod
  isOnDuty: boolean
  expert?: { id: string; loginId: string; isActive: boolean }
}

export interface WorkOrderDto {
  id: string
  caseId?: string | null
  expertId: string
  type: WorkOrderType
  status: WorkOrderStatus
  grade?: string | null
  title: string
  content: string
  suggestion?: string | null
  createdAt: string
  expert?: { id: string; loginId: string } | null
  case?: { id: string } | null
}

export interface DashboardDto {
  caseStatusDistribution: { status: string; count: number }[]
  expertStats: {
    expertId: string
    loginId: string
    avgScore: number
    ratingCount: number
    complaintCount: number
  }[]
  totalComplaints: number
}

function queryString(params: Record<string, string | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join('&')
  return qs ? `?${qs}` : ''
}

export function listAdminCases(status?: string) {
  return request<{ cases: CaseDto[] }>(`/admin/cases${queryString({ status })}`)
}

export function getAdminCase(caseId: string) {
  return request<{ case: CaseDto }>(`/admin/cases/${caseId}`)
}

export function reviewCase(caseId: string, approved: boolean, rejectReason?: string) {
  return request<{ case: CaseDto }>(`/admin/cases/${caseId}/review`, {
    method: 'POST',
    body: JSON.stringify({ approved, rejectReason }),
  })
}

export function listExperts() {
  return request<{ experts: ExpertDto[] }>('/admin/experts')
}

export function createExpert(loginId: string, password: string) {
  return request<{ expert: ExpertDto }>('/admin/experts', {
    method: 'POST',
    body: JSON.stringify({ loginId, password }),
  })
}

export function importExperts(file: File) {
  const body = new FormData()
  body.append('file', file)
  return request<{
    total: number
    created: number
    updated: number
    shiftsSet: number
    errors: string[]
  }>('/admin/experts/import', {
    method: 'POST',
    body,
  })
}

export function updateExpert(id: string, payload: { isActive?: boolean }) {
  return request<{ expert: ExpertDto }>(`/admin/experts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteExpert(id: string) {
  return request<{ message: string }>(`/admin/experts/${id}`, { method: 'DELETE' })
}

export function listShifts(date?: string) {
  return request<{ shifts: ShiftDto[] }>(`/admin/shifts${queryString({ date })}`)
}

export function upsertShift(payload: {
  expertId: string
  date: string
  period: ShiftPeriod
  isOnDuty: boolean
}) {
  return request<{ shift: ShiftDto }>('/admin/shifts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listRecords(params: { caseId?: string; expertId?: string; from?: string; to?: string }) {
  return request<{ cases: CaseDto[] }>(`/admin/records${queryString(params)}`)
}

export function getRecord(caseId: string) {
  return request<{ case: CaseDto }>(`/admin/records/${caseId}`)
}

export function createSupervision(
  caseId: string,
  payload: { grade: string; content: string; suggestion?: string },
) {
  return request<{ workOrder: WorkOrderDto }>(`/admin/records/${caseId}/supervision`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listWorkOrders(status?: string) {
  return request<{ workOrders: WorkOrderDto[] }>(`/admin/work-orders${queryString({ status })}`)
}

export function updateWorkOrderStatus(id: string, status: WorkOrderStatus) {
  return request<{ workOrder: WorkOrderDto }>(`/admin/work-orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

export function getDashboard() {
  return request<DashboardDto>('/admin/dashboard')
}
