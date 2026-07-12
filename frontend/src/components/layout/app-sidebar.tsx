// src/components/layout/app-sidebar.tsx
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { auth } = useAuthStore()
  
  // Get user info from auth store
  // Use fullName for doctors/patients, facilityName for facilities, fallback to username
  const displayName = auth.user?.fullName || auth.user?.facilityName || auth.user?.username || localStorage.getItem('pendingRegistrationUsername') || 'User'
  const userEmail = auth.user?.email || 'user@mdkli.com'
  const userPhoto = auth.user?.photoUrl || '/avatars/shadcn.jpg'
  
  // Update sidebar user data
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

  const navGroups = sidebarData.navGroups.map((group) => ({
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
                <div className='flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg overflow-hidden'>
                  <img
                    src='/images/logo.png'
                    alt='MDKLI'
                    className='size-8 object-contain dark:invert'
                    style={{ filter: 'var(--logo-filter)' }}
                  />
                </div>
                <div className='grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden'>
                  <span className='truncate font-semibold'>MDKLI</span>
                  <span className='truncate text-xs text-muted-foreground'>
                    Healthcare Platform
                  </span>
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
        
        {/* Doctor-specific items */}
        {auth.user?.role === 'doctor' && (
          <NavGroup 
            title="Doctor" 
            items={getDoctorSidebarItems(auth.user?.role)} 
          />
        )}

        {/* Facility Management — hospitals and medical centers only */}
        {auth.user?.role === 'clinic_admin' && (
          <NavGroup
            title="Facility Management"
            items={getFacilitySidebarItems(auth.user?.role)}
          />
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {/* Search button */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip='Search'>
              <Link to='/search'>
                <Search className='size-4' />
                <span>Search</span>
                <kbd className='ml-auto pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 group-data-[collapsible=icon]:hidden sm:flex'>
                  ⌘K
                </kbd>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {/* Language — no-op for now */}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => {}} tooltip='Language'>
              <Languages />
              <span>Language</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {/* Theme toggle */}
        <ThemeSwitch />
        <NavUser user={userData} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
