const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

import { getCookie, removeCookie } from './cookies'

const ACCESS_TOKEN_COOKIE = 'thisisjustarandomstring'
const REFRESH_TOKEN_COOKIE = 'refreshtoken'

let isHandlingSessionExpiry = false

function handleSessionExpired() {
  if (isHandlingSessionExpiry) return
  isHandlingSessionExpiry = true

  removeCookie(ACCESS_TOKEN_COOKIE)
  removeCookie(REFRESH_TOKEN_COOKIE)
  localStorage.removeItem('user')

  // Hard redirect so every store/component resets cleanly
  window.location.href = '/sign-in'
}

interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit & { params?: Record<string, string> } = {}
): Promise<ApiResponse<T>> {
  let url = `${API_URL}${endpoint}`
  
  // Add query params if provided
  if (options.params) {
    const searchParams = new URLSearchParams(options.params)
    url += `?${searchParams.toString()}`
  }
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }

  // Add auth token if available from cookies
  const token = getCookie('thisisjustarandomstring')
  if (token) {
    try {
      const parsedToken = JSON.parse(token)
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${parsedToken}`,
      }
    } catch {
      // Invalid token format, skip
    }
  }

  try {
    const response = await fetch(url, config)
    const data = await response.json()

    if (response.status === 401) {
      handleSessionExpired()
      return {
        error: data.message || 'Session expired',
      }
    }

    if (!response.ok) {
      return {
        error: data.message || 'An error occurred',
      }
    }

    return { data }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    apiClient<{ token: string; message: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  // Old registration (immediate)
  register: (userData: any) =>
    apiClient<{ userId: string; role: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  // New delayed registration
  startRegistration: (userData: any) =>
    apiClient<{ pendingToken: string; role: string; message: string }>('/auth/register/start', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  completeRegistration: (pendingToken: string, onboardingData: any) =>
    apiClient<{ userId: string; role: string; token: string; message: string }>('/auth/register/complete', {
      method: 'POST',
      body: JSON.stringify({ pendingToken, onboardingData }),
    }),

  checkPendingRegistration: (pendingToken: string) =>
    apiClient<{ role: string; email: string }>(`/auth/register/pending/${pendingToken}`, {
      method: 'GET',
    }),

  refreshToken: (refreshToken: string) =>
    apiClient<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  requestPasswordReset: (email: string) =>
    apiClient('/auth/password-request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, email: string, newPassword: string) =>
    apiClient('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, email, newPassword }),
    }),
}

// Profile API
export const profileApi = {
  getProfile: () =>
    apiClient('/api/profile/me', {
      method: 'GET',
    }),

  updateProfile: (data: any) =>
    apiClient('/api/profile/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateAccount: (data: any) =>
    apiClient('/api/profile/me/account', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteAccount: () =>
    apiClient<{ message: string }>('/api/profile/me', {
      method: 'DELETE',
    }),

  // Delete a branch
  deleteBranch: (branchId: string) =>
    apiClient<{ message: string }>(`/api/profile/branches/${branchId}`, {
      method: 'DELETE',
    }),
}

// Media API
export const mediaApi = {
  uploadProfilePicture: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient('/api/media/profile-picture', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set content-type with boundary
    })
  },

  uploadBranchMedia: (branchId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient(`/api/media/branch/${branchId}`, {
      method: 'POST',
      body: formData,
      headers: {},
    })
  },

  deleteBranchMedia: (branchId: string, mediaUrl: string) =>
    apiClient('/api/media/branch', {
      method: 'DELETE',
      body: JSON.stringify({ branchId, mediaUrl }),
    }),
}

// Invitation API
export const invitationApi = {
  // Find doctors by email/name/specialty
  findDoctors: (query: string, facilityId: string) =>
    apiClient<{ data: any[] }>(`/api/invitations/doctors/search?query=${encodeURIComponent(query)}&facilityId=${facilityId}`, {
      method: 'GET',
    }),

  // Get facility branches for invitation
  getFacilityBranches: (facilityId: string) =>
    apiClient<{ data: any[] }>(`/api/invitations/facility/${facilityId}/branches`, {
      method: 'GET',
    }),

  // Create invitation
  createInvitation: (data: {
    doctorId: string
    facilityId: string
    branches: { branchId: string; consultationFee: number }[]
    message?: string
  }) =>
    apiClient<{ invitationId: string; message: string }>('/api/invitations/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get facility invitations
  getFacilityInvitations: (facilityId: string, status?: string) =>
    apiClient<{ data: any[] }>(`/api/invitations/facility/${facilityId}${status ? `?status=${status}` : ''}`, {
      method: 'GET',
    }),

  // Get doctor invitations
  getDoctorInvitations: (status?: string) =>
    apiClient<{ data: any[] }>(`/api/invitations/doctor${status ? `?status=${status}` : ''}`, {
      method: 'GET',
    }),

  // Accept invitation
  acceptInvitation: (invitationId: string) =>
    apiClient<{ message: string }>(`/api/invitations/${invitationId}/accept`, {
      method: 'POST',
    }),

  // Reject invitation
  rejectInvitation: (invitationId: string) =>
    apiClient<{ message: string }>(`/api/invitations/${invitationId}/reject`, {
      method: 'POST',
    }),

  // Cancel invitation
  cancelInvitation: (invitationId: string) =>
    apiClient<{ message: string }>(`/api/invitations/${invitationId}/cancel`, {
      method: 'POST',
    }),

  // Get doctor's facility branches (from accepted invitations)
  getDoctorFacilityBranches: () =>
    apiClient<{ data: any[] }>('/api/invitations/my-branches', {
      method: 'GET',
    }),

  // Kick doctor from branch (for facility owners)
  kickDoctorFromBranch: (doctorId: string, branchId: string) =>
    apiClient<{ message: string }>('/api/invitations/kick', {
      method: 'POST',
      body: JSON.stringify({ doctorId, branchId }),
    }),

  // Doctor leaves branch
  leaveBranch: (branchId: string) =>
    apiClient<{ message: string }>('/api/invitations/leave', {
      method: 'POST',
      body: JSON.stringify({ branchId }),
    }),

  // Doctor leaves facility (all branches)
  leaveFacility: (facilityId: string) =>
    apiClient<{ message: string }>('/api/invitations/leave-facility', {
      method: 'POST',
      body: JSON.stringify({ facilityId }),
    }),

  // Get doctors assigned to a branch
  getBranchDoctors: (branchId: string) =>
    apiClient<{ data: any[] }>(`/api/invitations/branch/${branchId}/doctors`, {
      method: 'GET',
    }),
}

// Booking API
export const bookingApi = {
  // Get doctor settings
  getDoctorSettings: (doctorId: string) =>
    apiClient<{ success: boolean; data: any }>('/api/booking/doctor/settings', {
      method: 'GET',
      params: { doctorId },
    }),

  // Update doctor settings
  updateDoctorSettings: (doctorId: string, data: any) =>
    apiClient<{ success: boolean; data: any }>('/api/booking/doctor/settings', {
      method: 'PUT',
      body: JSON.stringify({ ...data, doctorId }),
    }),

  // Get pending sessions for a doctor
  getPendingSessions: (doctorId: string) =>
    apiClient<{ success: boolean; data: any[] }>('/api/booking/doctor/appointments', {
      method: 'GET',
      params: { doctorId, status: 'PENDING' },
    }),

  // Get session history for a doctor
  getSessionHistory: (doctorId: string, status?: string) =>
    apiClient<{ success: boolean; data: any[] }>('/api/booking/doctor/appointments', {
      method: 'GET',
      params: status
        ? { doctorId, status: status.toUpperCase() }
        : { doctorId },
    }),

  // Accept a session
  acceptSession: (sessionId: string) =>
    apiClient<{ success: boolean; data: any }>(`/api/booking/doctor/appointments/${sessionId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CONFIRMED' }),
    }),

  // Reject a session
  rejectSession: (sessionId: string) =>
    apiClient<{ success: boolean; data: any }>(`/api/booking/doctor/appointments/${sessionId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CANCELLED' }),
    }),

  // Reschedule a session
  rescheduleSession: (sessionId: string, data: { booking_date: string; start_time: string; end_time: string }) =>
    apiClient<{ success: boolean; data: any }>(`/api/booking/doctor/appointments/${sessionId}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({
        date: data.booking_date,
        startTime: data.start_time,
        endTime: data.end_time,
      }),
    }),

  // Get rules for a branch
  getDoctorBranchAvailability: (branchId: string) =>
    apiClient<{ success: boolean; data: any[] }>(`/api/booking/doctor/branches/${branchId}/availability`, {
      method: 'GET',
    }),

  // Replace all branch rules in one request
  replaceDoctorBranchAvailability: (
    branchId: string,
    data: { doctorId: string; rules: Array<{ dayOfWeek: number; startTime: string; endTime: string; slotDurationMinutes: number }> }
  ) =>
    apiClient<{ success: boolean; data: any[] }>(`/api/booking/doctor/branches/${branchId}/availability`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Get branch availability overrides (block-out and extra)
  getDoctorBranchOverrides: (branchId: string) =>
    apiClient<{ success: boolean; data: any[] }>(`/api/booking/doctor/branches/${branchId}/overrides`, {
      method: 'GET',
    }),

  // Create a block-out/extra override for a branch
  createDoctorBranchOverride: (
    branchId: string,
    data: { date: string; type: 'BLOCK' | 'EXTRA'; startTime?: string; endTime?: string; reason?: string }
  ) =>
    apiClient<{ success: boolean; data: any }>(`/api/booking/doctor/branches/${branchId}/overrides`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Delete override
  deleteDoctorBranchOverride: (branchId: string, overrideId: string) =>
    apiClient<{ success: boolean; message: string }>(`/api/booking/doctor/branches/${branchId}/overrides/${overrideId}`, {
      method: 'DELETE',
    }),

  // Get doctor availability for public booking (New booking service)
  getDoctorAvailabilityForBooking: (_doctorId: string, branchId: string) =>
    apiClient<{ success: boolean; data: any[] }>(`/api/booking/public/branches/${branchId}/availability-week`, {
      method: 'GET',
    }),

  // Get doctor branches for booking (New booking service)
  getDoctorBranchesForBooking: (doctorId: string) =>
    apiClient<{ success: boolean; data: any }>(`/api/booking/public/doctors/${doctorId}`, {
      method: 'GET',
    }),
  getMyAppointments: (patientId: string) =>
      apiClient<{ success: boolean; data: any[] }>('/api/booking/public/appointments/my', {
        method: 'GET',
        params: { patientId },
      }),
  // Create a booking (New booking service)
  createBooking: (data: {
    doctor_id: string
    branch_id: string
    patient_id: string
    booking_date: string
    start_time: string
    end_time: string
    reason?: string
    notes?: string
  }) =>
    apiClient<{ success: boolean; data: any }>('/api/booking/public/appointments', {
      method: 'POST',
      body: JSON.stringify({
        branchId: data.branch_id,
        patientId: data.patient_id,
        date: data.booking_date,
        startTime: data.start_time,
        endTime: data.end_time,
        notes: data.notes || data.reason
      }),
    }),
}
