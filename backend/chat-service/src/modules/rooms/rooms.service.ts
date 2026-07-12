import { prisma } from '../../lib/prisma'
import { logger } from '../../utils/logger'

const MAX_MESSAGES_BEFORE_UNLOCK = 2
// Spam guard that still applies after unlock — generous, just stops abuse.
const SPAM_LIMIT_PER_MINUTE = 20

function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

export class RoomAccessError extends Error {
  code: 'BLOCKED' | 'CAPPED' | 'SPAM' | 'SELF_CHAT' | 'NOT_FOUND'
  constructor(code: RoomAccessError['code'], message: string) {
    super(message)
    this.code = code
  }
}

export async function getOrCreateRoom(userId: string, targetUserId: string) {
  if (userId === targetUserId) {
    throw new RoomAccessError('SELF_CHAT', 'Cannot open a chat with yourself')
  }

  const [userAId, userBId] = sortPair(userId, targetUserId)

  let room = await prisma.chatRoom.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
    include: { state: true },
  })

  if (!room) {
    room = await prisma.chatRoom.create({
      data: {
        userAId,
        userBId,
        state: { create: { messageCountBeforeUnlock: 0, isUnlocked: false } },
      },
      include: { state: true },
    })
    logger.info(`Created room ${room.id} for ${userAId} <-> ${userBId}`)
  }

  return room
}

export async function listRoomsForUser(userId: string) {
  return prisma.chatRoom.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    include: {
      state: true,
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getMessages(roomId: string, userId: string, cursor?: string, take = 30) {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } })
  if (!room || (room.userAId !== userId && room.userBId !== userId)) {
    throw new RoomAccessError('NOT_FOUND', 'Room not found')
  }

  return prisma.message.findMany({
    where: { roomId },
    orderBy: { createdAt: 'desc' },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
}

export async function markMessagesAsRead(roomId: string, userId: string) {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } })
  if (!room || (room.userAId !== userId && room.userBId !== userId)) {
    throw new RoomAccessError('NOT_FOUND', 'Room not found')
  }

  await prisma.message.updateMany({
    where: { roomId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  })

  const otherUserId = room.userAId === userId ? room.userBId : room.userAId
  return { otherUserId }
}
/**
 * Central send-message gate. Used by BOTH the socket layer and any REST fallback,
 * so the rules are enforced in exactly one place. Never trust the caller's claim
 * about cap/unlock/block state — always re-check against the DB.
 */
export async function sendMessage(params: {
  roomId: string
  senderId: string
  type: 'text' | 'image' | 'video' | 'file' | 'audio'
  content?: string
  mediaUrl?: string
  mediaSize?: number
}) {
  const room = await prisma.chatRoom.findUnique({
    where: { id: params.roomId },
    include: { state: true },
  })

  if (!room || (room.userAId !== params.senderId && room.userBId !== params.senderId)) {
    throw new RoomAccessError('NOT_FOUND', 'Room not found')
  }

  const state = room.state
  if (state?.blockedBy) {
    throw new RoomAccessError('BLOCKED', 'This conversation is blocked')
  }

  const otherUserId = room.userAId === params.senderId ? room.userBId : room.userAId

  if (!state?.isUnlocked) {
    // Count only the current sender's messages so far in this room
    const senderMessageCount = await prisma.message.count({
      where: { roomId: room.id, senderId: params.senderId },
    })

    if (senderMessageCount >= MAX_MESSAGES_BEFORE_UNLOCK) {
      throw new RoomAccessError(
        'CAPPED',
        `You've reached your ${MAX_MESSAGES_BEFORE_UNLOCK}-message limit, waiting for a reply`
      )
    }
  } else {
    // Spam guard, applies post-unlock
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
    const recentCount = await prisma.message.count({
      where: { roomId: room.id, senderId: params.senderId, createdAt: { gte: oneMinuteAgo } },
    })
    if (recentCount >= SPAM_LIMIT_PER_MINUTE) {
      throw new RoomAccessError('SPAM', 'Too many messages, please slow down')
    }
  }

  const message = await prisma.message.create({
    data: {
      roomId: room.id,
      senderId: params.senderId,
      type: params.type,
      content: params.content,
      mediaUrl: params.mediaUrl,
      mediaSize: params.mediaSize,
    },
  })

  // Unlock logic: if the sender is NOT the one who sent the very first message in the
  // room, they are "replying" — this unlocks the room permanently.
  if (!state?.isUnlocked) {
    const firstMessage = await prisma.message.findFirst({
      where: { roomId: room.id },
      orderBy: { createdAt: 'asc' },
    })
    if (firstMessage && firstMessage.senderId !== params.senderId) {
      await prisma.roomState.update({
        where: { roomId: room.id },
        data: { isUnlocked: true },
      })
    }
  }

  return { message, otherUserId }
}

export async function blockUser(roomId: string, blockerId: string) {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId } })
  if (!room || (room.userAId !== blockerId && room.userBId !== blockerId)) {
    throw new RoomAccessError('NOT_FOUND', 'Room not found')
  }
  await prisma.roomState.upsert({
    where: { roomId },
    create: { roomId, blockedBy: blockerId },
    update: { blockedBy: blockerId },
  })
}

export async function unblockUser(roomId: string, requesterId: string) {
  const room = await prisma.chatRoom.findUnique({ where: { id: roomId }, include: { state: true } })
  if (!room || (room.userAId !== requesterId && room.userBId !== requesterId)) {
    throw new RoomAccessError('NOT_FOUND', 'Room not found')
  }
  // Only the person who placed the block can lift it
  if (room.state?.blockedBy !== requesterId) {
    throw new RoomAccessError('BLOCKED', 'Only the blocker can unblock')
  }
  await prisma.roomState.update({
    where: { roomId },
    data: { blockedBy: null },
  })
}
