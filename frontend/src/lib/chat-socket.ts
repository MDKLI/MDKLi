import { io, Socket } from 'socket.io-client'
import { getCookie } from './cookies'
import { type ChatMessage } from './chat-api'

const ACCESS_TOKEN_COOKIE = 'thisisjustarandomstring'
// Direct to chat-service for now — swap to a proxied path once nginx/vite
// is configured for WebSocket upgrades (raw http.request proxying can't do this).
const CHAT_SOCKET_URL = import.meta.env.VITE_CHAT_SOCKET_URL || 'http://localhost:3005'

let socket: Socket | null = null

function getToken(): string | null {
  const raw = getCookie(ACCESS_TOKEN_COOKIE)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function connectChatSocket(): Socket {
  if (socket?.connected) return socket

  socket = io(CHAT_SOCKET_URL, {
    auth: { token: getToken() },
    transports: ['websocket'],
  })

  return socket
}

export function disconnectChatSocket(): void {
  socket?.disconnect()
  socket = null
}

export function joinRoom(roomId: string): void {
  socket?.emit('join_room', roomId)
}

export function leaveRoom(roomId: string): void {
  socket?.emit('leave_room', roomId)
}

export function sendMessage(
  payload: {
    roomId: string
    type: ChatMessage['type']
    content?: string
    mediaUrl?: string
    mediaSize?: number
  },
  ack?: (response: { ok: boolean; error?: string; code?: string }) => void
): void {
  socket?.emit('send_message', payload, ack)
}

export function onReceiveMessage(handler: (message: ChatMessage) => void): () => void {
  socket?.on('receive_message', handler)
  return () => socket?.off('receive_message', handler)
}

export function markRead(roomId: string): void {
  socket?.emit('mark_read', roomId)
}

export function onNewMessage(
  handler: (data: { roomId: string; message: ChatMessage }) => void
): () => void {
  socket?.on('new_message', handler)
  return () => socket?.off('new_message', handler)
}

export function onMessagesRead(
  handler: (data: { roomId: string; readerId: string }) => void
): () => void {
  socket?.on('messages_read', handler)
  return () => socket?.off('messages_read', handler)
}

export function onRoomBlocked(
  handler: (data: { roomId: string; blockedBy: string }) => void
): () => void {
  socket?.on('room_blocked', handler)
  return () => socket?.off('room_blocked', handler)
}

export function onRoomUnblocked(
  handler: (data: { roomId: string }) => void
): () => void {
  socket?.on('room_unblocked', handler)
  return () => socket?.off('room_unblocked', handler)
}
