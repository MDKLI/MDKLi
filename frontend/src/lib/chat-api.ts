import { getCookie } from './cookies'

const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL || 'http://localhost:3005'
const ACCESS_TOKEN_COOKIE = 'thisisjustarandomstring'

export interface ChatUserSummary {
  id: string
  name: string
  photoUrl: string | null
  role: string
  about: string | null
}

export interface ChatMessage {
  id: string
  roomId: string
  senderId: string
  type: 'text' | 'image' | 'video' | 'file' | 'audio'
  content: string | null
  mediaUrl: string | null
  mediaSize: number | null
  createdAt: string
  readAt: string | null
}

export interface ChatRoomSummary {
  id: string
  otherUser: ChatUserSummary
  lastMessage: ChatMessage | null
  isUnlocked: boolean
  blockedBy: string | null
  unreadCount: number
}

interface ChatApiResponse<T> {
  data?: T
  error?: string
}

async function chatFetch<T>(
  endpoint: string,
  options: RequestInit & { params?: Record<string, string> } = {}
): Promise<ChatApiResponse<T>> {
  let url = `${CHAT_API_URL}${endpoint}`
  if (options.params) {
    url += `?${new URLSearchParams(options.params).toString()}`
  }

  const config: RequestInit = {
    ...options,
    headers: { ...options.headers },
  }

  const token = getCookie(ACCESS_TOKEN_COOKIE)
  if (token) {
    try {
      const parsedToken = JSON.parse(token)
      config.headers = { ...config.headers, Authorization: `Bearer ${parsedToken}` }
    } catch {
      // invalid token format, skip
    }
  }

  try {
    const response = await fetch(url, config)
    const body = await response.json()
    if (!response.ok) {
      return { error: body.error || 'An error occurred' }
    }
    return body // chat-service already returns { data: T } — don't re-wrap it
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Network error' }
  }
}

export const chatApi = {
getRooms: () => chatFetch<ChatRoomSummary[]>('/rooms', { method: 'GET' }),

  getMessages: (roomId: string, cursor?: string, take?: number) =>
    chatFetch<ChatMessage[]>(`/rooms/${roomId}/messages`, {
      method: 'GET',
      params: { ...(cursor ? { cursor } : {}), ...(take ? { take: String(take) } : {}) },
    }),

  // Create-or-get — the single entry point every "Chat" button should call
  openRoomWith: (targetUserId: string) =>
    chatFetch<{ id: string }>(`/rooms/with/${targetUserId}`, { method: 'POST' }),

  blockRoom: (roomId: string) =>
    chatFetch<{ blocked: boolean }>(`/rooms/${roomId}/block`, { method: 'POST' }),

  unblockRoom: (roomId: string) =>
    chatFetch<{ blocked: boolean }>(`/rooms/${roomId}/unblock`, { method: 'POST' }),

  uploadMedia: (roomId: string, file: File, type: 'image' | 'video' | 'file' | 'audio') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    return chatFetch<{ url: string; size: number; type: string }>(`/media/upload/${roomId}`, {
      method: 'POST',
      body: formData,
    })
  },
}
