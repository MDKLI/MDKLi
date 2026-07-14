import { Languages, Search } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { ThemeSwitch } from '@/components/theme-switch'
import { useAuthStore } from '@/stores/auth-store'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useEffect } from 'react'
import { useChatStore } from '@/stores/chat-store'
import { chatApi } from '@/lib/chat-api'
import { connectChatSocket, onNewMessage, onMessagesRead } from '@/lib/chat-socket'
import { sidebarData, getDoctorSidebarItems, getFacilitySidebarItems } from './data/sidebar-data'
import { useSidebar } from '@/components/ui/sidebar'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { auth } = useAuthStore()
  const { setOpen } = useSidebar()

  useEffect(() => {
    setOpen(true)
    document.cookie = 'sidebar_state=expanded; path=/; max-age=31536000'
  }, [])

  const displayName = auth.user?.fullName || auth.user?.facilityName || auth.user?.username || localStorage.getItem('pendingRegistrationUsername') || 'User'
  const userEmail = auth.user?.email || 'user@mdkli.com'
  const userPhoto = auth.user?.photoUrl || '/avatars/shadcn.jpg'

  const userData = {
    name: displayName,
    email: userEmail,
    avatar: userPhoto,
  }

  const unreadCount = useChatStore((s) => s.unreadCount)
  const setUnreadCount = useChatStore((s) => s.setUnreadCount)

  useEffect(() => {
    connectChatSocket()
    const refreshUnread = () => {
      chatApi.getRooms().then((result) => {
        if (result.data) {
          const total = result.data.reduce((sum, r) => sum + r.unreadCount, 0)
          setUnreadCount(total)
        }
      })
    }
    refreshUnread()
    const unsubNew = onNewMessage(() => refreshUnread())
    const unsubRead = onMessagesRead(() => refreshUnread())
    return () => {
      unsubNew()
      unsubRead()
    }
  }, [])

  const isAdmin = auth.user?.role === 'admin' || auth.user?.role === 'superadmin'

  const navGroups = sidebarData.navGroups
    .filter((group) => {
      if (isAdmin) return group.title === 'Admin'
      return group.title !== 'Admin'
    })
    .map((group) => ({
      ...group,
      items: group.items.map((item) =>
        item.title === 'Chats'
          ? { ...item, badge: unreadCount > 0 ? String(unreadCount) : undefined }
          : item
      ),
    }))

  return (
    <Sidebar variant='floating' side='left' collapsible='icon' {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size='lg' asChild>
              <a href='/'>
                <div className='flex aspect-square size-8 items-center justify-center shrink-0'>
                  <img
                    src='/images/logo.png'
                    alt='MDKLI'
                    className='size-8 object-contain'
                  />
                </div>
                <div className='grid flex-1 text-left text-sm leading-tight overflow-hidden group-data-[collapsible=icon]:hidden'>
                  <span className='truncate font-semibold whitespace-nowrap'>MDKLI</span>
                  <span className='truncate text-xs text-muted-foreground whitespace-nowrap'>Healthcare Platform</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <NavGroup key={group.title} {...group} />
        ))}

        {!isAdmin && auth.user?.role === 'doctor' && (
          <NavGroup title="Doctor" items={getDoctorSidebarItems(auth.user?.role)} />
        )}

        {!isAdmin && auth.user?.role === 'clinic_admin' && (
          <NavGroup title="Facility Management" items={getFacilitySidebarItems(auth.user?.role)} />
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip='Search'>
              <Link to='/search'>
                <Search className='size-4 shrink-0' />
                <span className='overflow-hidden whitespace-nowrap group-data-[collapsible=icon]:hidden'>Search</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => {}} tooltip='Language'>
              <Languages className='size-4 shrink-0' />
              <span className='overflow-hidden whitespace-nowrap group-data-[collapsible=icon]:hidden'>Language</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <ThemeSwitch />

        <NavUser user={userData} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
