import { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronsUpDown, LogOut, MapPin, Palette, User, UserPlus, Mail, Users, Heart } from 'lucide-react'
import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { useAuthStore } from '@/stores/auth-store'
import { profileApi } from '@/lib/api'

type NavUserProps = { user: { name: string; email: string; avatar: string } }

export function NavUser({ user }: NavUserProps) {
  const { isMobile } = useSidebar()
  const [open, setOpen] = useDialogState()
  const { auth } = useAuthStore()
  
  const userRole = auth.user?.role || ''
  const isPatient = userRole === 'patient'
  const isClinicAdmin = userRole === 'clinic_admin'
  const isPharmacyAdmin = userRole === 'pharmacy_admin'
  const isFacility = isClinicAdmin || isPharmacyAdmin
  const isAdmin = userRole === 'admin' || userRole === 'superadmin'
  
  const [facilityType, setFacilityType] = useState<string | null>(null)
  
  useEffect(() => {
    if (isFacility) {
      loadFacilityProfile()
    }
  }, [isFacility])
  
  const loadFacilityProfile = async () => {
    try {
      const result: any = await profileApi.getProfile()
      const profile = result?.data
      setFacilityType(profile?.facility_type || null)
    } catch (error) {
      console.error('Failed to load facility profile:', error)
      setFacilityType(null)
    }
  }
  
  const canInviteDoctors = facilityType === 'hospital' || facilityType === 'center'

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size='lg' className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'>
                <Avatar className='h-8 w-8 rounded-lg shrink-0'>
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className='rounded-lg'>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className='grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden'>
                  <span className='truncate font-semibold'>{user.name}</span>
                  <span className='truncate text-xs text-muted-foreground'>{user.email}</span>
                </div>
                <ChevronsUpDown className='ml-auto size-4 shrink-0 group-data-[collapsible=icon]:hidden' />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg' side={isMobile ? 'bottom' : 'right'} align='end' sideOffset={4}>
              <DropdownMenuLabel className='p-0 font-normal'>
                <div className='flex items-center gap-2 px-1 py-1.5 text-start text-sm'>
                  <Avatar className='h-8 w-8 rounded-lg'>
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className='rounded-lg'>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className='grid flex-1 text-start text-sm leading-tight'>
                    <span className='truncate font-semibold'>{user.name}</span>
                    <span className='truncate text-xs text-muted-foreground'>{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Settings</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link to='/settings'><User className="mr-2 h-4 w-4" /> Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to='/settings/appearance'><Palette className="mr-2 h-4 w-4" /> Appearance</Link>
                </DropdownMenuItem>
                {!isPatient && !isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to='/settings/branches'><MapPin className="mr-2 h-4 w-4" /> Branches</Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              
              {!isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link to='/wishlist'><Heart className="mr-2 h-4 w-4" /> Wishlist</Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}

              {canInviteDoctors && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Facility Management</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild><Link to='/invite-doctor'><UserPlus className="mr-2 h-4 w-4" /> Invite Doctor</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to='/my-invitations'><Mail className="mr-2 h-4 w-4" /> My Invitations</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to='/branch-doctors'><Users className="mr-2 h-4 w-4" /> Branch Doctors</Link></DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant='destructive' onClick={() => setOpen(true)}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
