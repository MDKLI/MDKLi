import { toast } from 'sonner'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Fragment } from 'react/jsx-runtime'
import { format } from 'date-fns'
import {
  ArrowLeft,
  Ban,
  CheckCheck,
  MoreVertical,
  Search as SearchIcon,
  Send,
  MessagesSquare,
} from 'lucide-react'
import { cn, getDisplayNameInitials } from '@/lib/utils'
import { chatApi, type ChatMessage, type ChatRoomSummary } from '@/lib/chat-api'
import {
  joinRoom,
  leaveRoom,
  onReceiveMessage,
  onMessagesRead,
  onRoomBlocked,
  onRoomUnblocked,
  markRead,
  sendMessage as emitSendMessage,
} from '@/lib/chat-socket'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Main } from '@/components/layout/main'
import { MediaDropdown } from './components/media-dropdown'
import { useNavigate } from '@tanstack/react-router'
import { useChatStore } from '@/stores/chat-store'
import { useAuthStore } from '@/stores/auth-store'

export function Chats() {
  const [search, setSearch] = useState('')
  const [rooms, setRooms] = useState<ChatRoomSummary[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [isCapped, setIsCapped] = useState(false)
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null)

  const navigate = useNavigate()
 
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) || null
  const setUnreadCount = useChatStore((s) => s.setUnreadCount)
  const { auth } = useAuthStore()

  // Open a specific room if the URL says so (?room=<id>), e.g. from a "Chat" button elsewhere
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const roomParam = params.get('room')
    if (roomParam) {
      setSelectedRoomId(roomParam)
      setMobileOpen(true)
    }
  }, [])

  useEffect(() => {
      loadRooms()
    }, [])

  useEffect(() => {
    if (!selectedRoomId) return
    setIsCapped(false)
    joinRoom(selectedRoomId)
    loadMessages(selectedRoomId)

    const unsubscribeMsg = onReceiveMessage((msg) => {
      if (msg.roomId !== selectedRoomId) {
        loadRooms()
        return
      }
      setMessages((prev) => [...prev, msg])
      if (msg.senderId !== auth.user?.id) {
        markRead(selectedRoomId)
        setRooms((prev) => prev.map((r) => (r.id === selectedRoomId ? { ...r, unreadCount: 0 } : r)))
      }
    })

    const unsubscribeRead = onMessagesRead((data) => {
        if (data.roomId !== selectedRoomId) return
        setMessages((prev) =>
          prev.map((m) => (m.readAt ? m : { ...m, readAt: new Date().toISOString() }))
        )
        setRooms((prev) => prev.map((r) => (r.id === data.roomId ? { ...r, unreadCount: 0 } : r)))
    })

    const unsubscribeBlocked = onRoomBlocked((data) => {
      if (data.roomId !== selectedRoomId) return
      setRooms((prev) =>
        prev.map((r) => (r.id === data.roomId ? { ...r, blockedBy: data.blockedBy } : r))
      )
    })

    const unsubscribeUnblocked = onRoomUnblocked((data) => {
      if (data.roomId !== selectedRoomId) return
      setRooms((prev) =>
        prev.map((r) => (r.id === data.roomId ? { ...r, blockedBy: null } : r))
      )
    })

    return () => {
      leaveRoom(selectedRoomId)
      unsubscribeMsg()
      unsubscribeRead()
      unsubscribeBlocked()
      unsubscribeUnblocked()
    }
  }, [selectedRoomId])

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadRooms() {
    const result = await chatApi.getRooms()
    if (result.data) {
      setRooms(result.data)
      const myId = auth.user?.id
      const unread = result.data.filter(
        (r) => r.lastMessage && !r.lastMessage.readAt && r.lastMessage.senderId !== myId
      ).length
      setUnreadCount(unread)
    }
  }

  async function loadMessages(roomId: string) {
    const result = await chatApi.getMessages(roomId)
    if (result.data) setMessages(result.data.slice().reverse())
    markRead(roomId)
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r)))
  }

  const filteredRooms = useMemo(
    () =>
      rooms.filter((r) =>
        r.otherUser.name.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [rooms, search]
  )

  const groupedMessages = useMemo(() => {
    return messages.reduce((acc: Record<string, ChatMessage[]>, msg) => {
      const key = format(new Date(msg.createdAt), 'd MMM, yyyy')
      if (!acc[key]) acc[key] = []
      acc[key].push(msg)
      return acc
    }, {})
  }, [messages])

  const isBlocked = !!selectedRoom?.blockedBy
  const iPlacedTheBlock = selectedRoom?.blockedBy === auth.user?.id
  // so both sides just see "This conversation is blocked" generically; the block/unblock
  // button below only succeeds for whoever actually placed the block (server-enforced).

  async function handleSend() {
    if (!selectedRoomId || !messageInput.trim()) return
    const content = messageInput
    setMessageInput('')

    emitSendMessage(
      { roomId: selectedRoomId, type: 'text', content },
      (response) => {
        if (!response.ok) {
          if (response.code === 'CAPPED' || response.code === 'SPAM') {
            setIsCapped(true)
          } else {
            toast.error(response.error || 'Failed to send message')
          }
          loadRooms()
        }
      }
    )
  }

  async function handleMediaSelect(file: File, type: 'image' | 'video' | 'file' | 'audio') {
    if (!selectedRoomId) return
    setUploading(true)
    try {
      const result = await chatApi.uploadMedia(selectedRoomId, file, type)
      if (result.error || !result.data) {
        toast.error(result.error || 'Upload failed')
        return
      }
      emitSendMessage(
        {
          roomId: selectedRoomId,
          type,
          mediaUrl: result.data.url,
          mediaSize: result.data.size,
        },
        (response) => {
          if (!response.ok) toast.error(response.error || 'Failed to send media')
        }
      )
    } finally {
      setUploading(false)
    }
  }

  async function handleBlock() {
    if (!selectedRoomId) return
    await chatApi.blockRoom(selectedRoomId)
    loadRooms()
  }

  async function handleUnblock() {
    if (!selectedRoomId) return
    const result = await chatApi.unblockRoom(selectedRoomId)
    if (result.error) toast.error(result.error)
    loadRooms()
  }

  const textboxDisabled = isBlocked || uploading

  let textboxMessage: string | null = null
  if (isBlocked) {
    textboxMessage = "This conversation is blocked. Unblock to continue."
  } else if (isCapped) {
    textboxMessage = "You've reached your 2-message limit, waiting for a reply."
  }
  // The 2-message cap message only appears as a server rejection, since the client
  // can't reliably know "have I sent 2 and they haven't replied" without asking —
  // handled via the send ack error below instead of a persistent banner.

  return (
    <Main fixed>
      <section className='flex h-full gap-6'>
        {/* Left Side */}
        <div className='flex w-full flex-col gap-2 sm:w-56 lg:w-72 2xl:w-80'>
          <div className='sticky top-0 z-10 -mx-4 bg-background px-4 pb-3 shadow-md sm:static sm:z-auto sm:mx-0 sm:p-0 sm:shadow-none'>
            <div className='flex items-center justify-between py-2'>
              <div className='flex gap-2'>
                <h1 className='text-2xl font-bold'>Inbox</h1>
                <MessagesSquare size={20} />
              </div>
            </div>
            <label
              className={cn(
                'focus-within:ring-1 focus-within:ring-ring focus-within:outline-hidden',
                'flex h-10 w-full items-center space-x-0 rounded-md border border-border ps-2'
              )}
            >
              <SearchIcon size={15} className='me-2 stroke-slate-500' />
              <span className='sr-only'>Search</span>
              <input
                type='text'
                className='w-full flex-1 bg-inherit text-sm focus-visible:outline-hidden'
                placeholder='Search chat...'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>

          <ScrollArea className='-mx-3 h-full overflow-scroll p-3'>
            {filteredRooms.map((room) => {
              const lastMsg = room.lastMessage
              const lastMsgPreview = lastMsg
                ? lastMsg.type === 'text'
                  ? lastMsg.content
                  : `Sent a ${lastMsg.type}`
                : 'No messages yet'
              return (
                <Fragment key={room.id}>
                  <button
                    type='button'
                    className={cn(
                      'group hover:bg-accent hover:text-accent-foreground',
                      'flex w-full rounded-md px-2 py-2 text-start text-sm',
                      selectedRoomId === room.id && 'sm:bg-muted'
                    )}
                    onClick={() => {
                      setSelectedRoomId(room.id)
                      setMobileOpen(true)
                    }}
                  >
                    <div className='flex w-full gap-2'>
                      <Avatar>
                        <AvatarImage src={room.otherUser.photoUrl || undefined} alt={room.otherUser.name} />
                        <AvatarFallback>{getDisplayNameInitials(room.otherUser.name)}</AvatarFallback>
                      </Avatar>
                      <div className='flex-1 min-w-0'>
                        <span className='col-start-2 row-span-2 font-medium'>
                          {room.otherUser.name}
                        </span>
                        <span className='col-start-2 row-span-2 row-start-2 line-clamp-2 text-ellipsis text-muted-foreground group-hover:text-accent-foreground/90'>
                          {lastMsgPreview}
                        </span>
                      </div>
                      {room.unreadCount > 0 && (
                        <span className='flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground'>
                          {room.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                  <Separator className='my-1' />
                </Fragment>
              )
            })}
          </ScrollArea>
        </div>

        {/* Right Side */}
        {selectedRoom ? (
          <div
            className={cn(
              'absolute inset-0 start-full z-50 hidden w-full flex-1 flex-col border bg-background shadow-xs sm:static sm:z-auto sm:flex sm:rounded-md',
              mobileOpen && 'inset-s-0 flex'
            )}
          >
            <div className='mb-1 flex flex-none justify-between bg-card p-4 shadow-lg sm:rounded-t-md'>
              <div className='flex gap-3'>
                <Button
                  size='icon'
                  variant='ghost'
                  className='-ms-2 h-full sm:hidden'
                  onClick={() => setMobileOpen(false)}
                >
                  <ArrowLeft className='rtl:rotate-180' />
                </Button>
                <div className='flex items-center gap-2 lg:gap-4'>
                  <Avatar className='size-9 lg:size-11'>
                    <AvatarImage
                      src={selectedRoom.otherUser.photoUrl || undefined}
                      alt={selectedRoom.otherUser.name}
                    />
                    <AvatarFallback>
                      {getDisplayNameInitials(selectedRoom.otherUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className='col-start-2 row-span-2 text-sm font-medium lg:text-base'>
                      {selectedRoom.otherUser.name}
                    </span>
                    {selectedRoom.otherUser.about && (
                      <span className='col-start-2 row-span-2 row-start-2 line-clamp-1 block max-w-32 text-xs text-nowrap text-ellipsis text-muted-foreground lg:max-w-none lg:text-sm'>
                        {selectedRoom.otherUser.about}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className='-me-1 flex items-center gap-1 lg:gap-2'>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size='icon' variant='ghost' className='h-10 rounded-md sm:h-8 sm:w-4 lg:h-10 lg:w-6'>
                      <MoreVertical className='stroke-muted-foreground sm:size-5' />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    {isBlocked ? (
                      iPlacedTheBlock && (
                        <DropdownMenuItem onSelect={handleUnblock}>Unblock</DropdownMenuItem>
                      )
                    ) : (
                      <DropdownMenuItem onSelect={handleBlock} className='text-destructive'>
                        <Ban className='me-2 size-4' />
                        Block
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className='flex flex-1 flex-col gap-2 rounded-md px-4 pt-0 pb-4'>
              <div className='flex size-full flex-1'>
                <div className='chat-text-container relative -me-4 flex flex-1 flex-col overflow-y-hidden'>
                  <div className='chat-flex flex h-40 w-full grow flex-col justify-start gap-4 overflow-y-auto py-2 pe-4 pb-4'>
                    {Object.keys(groupedMessages).map((key) => (
                      <Fragment key={key}>
                        <div className='text-center text-xs text-muted-foreground'>{key}</div>
                        {groupedMessages[key].map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              'chat-box max-w-72 px-3 py-2 wrap-break-word shadow-lg',
                              msg.senderId === selectedRoom.otherUser.id
                                ? 'self-start rounded-[16px_16px_16px_0] bg-muted'
                                : 'self-end rounded-[16px_16px_0_16px] bg-primary/90 text-primary-foreground/75'
                            )}
                          >
                            {msg.type === 'text' && msg.content}
                            {msg.type === 'image' && msg.mediaUrl && (
                              <img src={msg.mediaUrl} alt='Shared image' className='max-w-full rounded-md' />
                            )}
                            {msg.type === 'video' && msg.mediaUrl && (
                              <video src={msg.mediaUrl} controls className='max-w-full rounded-md' />
                            )}
                            {msg.type === 'audio' && msg.mediaUrl && <audio src={msg.mediaUrl} controls />}
                            {msg.type === 'file' && msg.mediaUrl && (
                              <a href={msg.mediaUrl} target='_blank' rel='noreferrer' className='underline'>
                                Download file
                              </a>
                            )}
                            <span
                              className={cn(
                                'mt-1 flex items-center gap-1 text-xs font-light text-foreground/75 italic',
                                msg.senderId !== selectedRoom.otherUser.id &&
                                  'justify-end text-primary-foreground/85'
                              )}
                            >
                              {format(new Date(msg.createdAt), 'h:mm a')}
                              {msg.senderId !== selectedRoom.otherUser.id && (
                                <CheckCheck
                                  size={14}
                                  className={msg.readAt ? 'text-sky-400' : 'text-primary-foreground/60'}
                                />
                              )}
                            </span>
                          </div>
                        ))}
                      </Fragment>
                    ))}
                    <div ref={scrollAnchorRef} />
                  </div>
                </div>
              </div>

              {textboxMessage ? (
                <div className='flex w-full flex-none items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground'>
                  {textboxMessage}
                </div>
              ) : (
              <form
                className='flex w-full flex-none gap-2'
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSend()
                }}
              >
                <div className='flex flex-1 items-center gap-2 rounded-md border border-input bg-card px-2 py-1 focus-within:ring-1 focus-within:ring-ring focus-within:outline-hidden lg:gap-4'>
                  <div className='space-x-1'>
                    <MediaDropdown disabled={textboxDisabled} onSelectFile={handleMediaSelect} />
                  </div>
                  <label className='flex-1'>
                    <span className='sr-only'>Chat Text Box</span>
                    <input
                      type='text'
                      placeholder={textboxDisabled ? '' : 'Type your messages...'}
                      className='h-8 w-full bg-inherit focus-visible:outline-hidden disabled:cursor-not-allowed'
                      value={messageInput}
                      disabled={textboxDisabled}
                      onChange={(e) => setMessageInput(e.target.value)}
                    />
                  </label>
                  <Button
                    type='submit'
                    variant='ghost'
                    size='icon'
                    className='hidden sm:inline-flex'
                    disabled={textboxDisabled || !messageInput.trim()}
                  >
                    <Send size={20} />
                  </Button>
                </div>
                <Button className='h-full sm:hidden' disabled={textboxDisabled || !messageInput.trim()}>
                  <Send size={18} /> Send
                </Button>
              </form>
              )}
            </div>
          </div>
        ) : (
          <div className='absolute inset-0 start-full z-50 hidden w-full flex-1 flex-col justify-center rounded-md border bg-card shadow-xs sm:static sm:z-auto sm:flex'>
            <div className='flex flex-col items-center space-y-6'>
              <div className='flex size-16 items-center justify-center rounded-full border-2 border-border'>
                <MessagesSquare className='size-8' />
              </div>
              <div className='space-y-2 text-center'>
                <h1 className='text-xl font-semibold'>
                  {rooms.length === 0 ? 'No conversations yet' : 'Your messages'}
                </h1>
                <p className='text-sm text-muted-foreground max-w-64'>
                  {rooms.length === 0
                    ? 'Find a doctor or pharmacy to start a conversation.'
                    : 'Chats open from a doctor, pharmacy, or invitation page.'}
                </p>
              </div>
              {rooms.length === 0 && (
                <Button onClick={() => navigate({ to: '/search' })}>
                  Find a Doctor or Pharmacy
                </Button>
              )}
            </div>
          </div>
        )}
      </section>
    </Main>
  )
}
