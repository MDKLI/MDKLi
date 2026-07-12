import { Server } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { verifySocketToken } from '../middleware/auth.middleware'
import { logger } from '../utils/logger'
import { sendMessage, markMessagesAsRead, RoomAccessError } from '../modules/rooms/rooms.service'

interface AuthedSocketData {
  userId: string
  role: string
}

let ioInstance: Server | null = null

export function getIO(): Server {
  if (!ioInstance) throw new Error('Socket.IO not initialized yet')
  return ioInstance
}

export function initSocketServer(server: HttpServer) {
  const io = new Server(server, {
    cors: { origin: '*' }, // tighten to your frontend origin(s) in production
  })
  ioInstance = io

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined
      const { userId, role } = verifySocketToken(token)
      ;(socket.data as AuthedSocketData) = { userId, role }
      next()
    } catch {
      next(new Error('Authentication failed'))
    }
  })

io.on('connection', (socket) => {
  const { userId } = socket.data as AuthedSocketData
  logger.info(`Socket connected: user ${userId}`)
  socket.join(`user:${userId}`)

  socket.on('join_room', (roomId: string) => {
    socket.join(roomId)
  })

  socket.on('leave_room', (roomId: string) => {
    socket.leave(roomId)
  })

  socket.on('mark_read', async (roomId: string) => {
    logger.info(`mark_read received: room=${roomId} reader=${userId}`)
    try {
      const { otherUserId } = await markMessagesAsRead(roomId, userId)
      logger.info(`mark_read done: notifying room=${roomId} and user=${otherUserId}`)
      io.to(roomId).emit('messages_read', { roomId, readerId: userId })
      io.to(`user:${otherUserId}`).emit('messages_read', { roomId, readerId: userId })
    } catch (error) {
      logger.error('mark_read failed:', error)
    }
  })

  socket.on(
    'send_message',
    async (
      payload: {
        roomId: string
        type: 'text' | 'image' | 'video' | 'file' | 'audio'
        content?: string
        mediaUrl?: string
        mediaSize?: number
      },
      ack?: (response: { ok: boolean; error?: string; code?: string }) => void
    ) => {
      try {
        const { message, otherUserId } = await sendMessage({
          roomId: payload.roomId,
          senderId: userId,
          type: payload.type,
          content: payload.content,
          mediaUrl: payload.mediaUrl,
          mediaSize: payload.mediaSize,
        })
        io.to(payload.roomId).emit('receive_message', message)
        io.to(`user:${otherUserId}`).emit('new_message', { roomId: payload.roomId, message })
        ack?.({ ok: true })
      } catch (error) {
        if (error instanceof RoomAccessError) {
          ack?.({ ok: false, error: error.message, code: error.code })
        } else {
          logger.error('send_message failed:', error)
          ack?.({ ok: false, error: 'Failed to send message' })
        }
      }
    }
  )

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: user ${userId}`)
  })
})

  return io
}
