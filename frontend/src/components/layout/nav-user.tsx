import { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ChevronsUpDown,
  LogOut,
  MapPin,
  Palette,
  Sparkles,
  User,
  Building2,
  UserPlus,
  Mail,
  Users,
} from 'lucide-react'
import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { useAuthStore } from '@/stores/auth-store'
import { profileApi } from '@/lib/api'

type NavUserProps = {
  user: {
    name: string
    email: string
    avatar: string
  }
}

export function NavUser({ user }: NavUserProps) {
  const { isMobile } = useSidebar()
  const [open, setOpen] = useDialogState()
  const { auth } = useAuthStore()
  const userRole = auth.user?.role || ''
  const isPatient = userRole === 'patient'
  const isDoctor = userRole === 'doctor'
  const isClinicAdmin = userRole === 'clinic_admin'
  const isPharmacyAdmin = userRole === 'pharmacy_admin'
  const isFacility = isClinicAdmin || isPharmacyAdmin
  const [facilityType, setFacilityType] = useState<string | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)
  
  // Load facility profile to get type
  useEffect(() => {
    if (isFacility) {
      loadFacilityProfile()
    }
  }, [isFacility])
  
  const loadFacilityProfile = async () => {
    setIsLoadingProfile(true)
    try {
      const result: any = await profileApi.getProfile()
      // The profile data is directly in result.data
      const profile = result?.data
      console.log('[NAV-USER] Profile loaded:', profile)
      
      // Check facility_type - it can be 'hospital', 'center', or 'pharmacy'
      const type = profile?.facility_type
      if (type) {
        setFacilityType(type)
        console.log('[NAV-USER] Facility type set to:', type)
      } else {
        console.log('[NAV-USER] No facility_type found in profile')
        setFacilityType(null)
      }
    } catch (error) {
      console.error('Failed to load facility profile:', error)
      setFacilityType(null)
    } finally {
      setIsLoadingProfile(false)
    }
  }
  
  // DEBUG: Log the current state
  console.log('[NAV-USER] Render - userRole:', userRole, 'facilityType:', facilityType, 'isLoadingProfile:', isLoadingProfile)
  
  // Only show facility management for hospitals and medical centers (NOT pharmacies)
  // STRICT: Must have facilityType === 'hospital' or 'center', pharmacy is excluded
  const canInviteDoctors = facilityType === 'hospital' || facilityType === 'center'

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size='lg'
                className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
              >
                <Avatar className='h-8 w-8 rounded-lg'>
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className='rounded-lg'>SN</AvatarFallback>
                </Avatar>
                <div className='grid flex-1 text-start text-sm leading-tight'>
                  <span className='truncate text-xs'>{user.email}</span>
                </div>
                <ChevronsUpDown className='ms-auto size-4' />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
              side={isMobile ? 'bottom' : 'right'}
              align='end'
              sideOffset={4}
            >
              <DropdownMenuLabel className='p-0 font-normal'>
                <div className='flex items-center gap-2 px-1 py-1.5 text-start text-sm'>
                  <Avatar className='h-8 w-8 rounded-lg'>
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className='rounded-lg'>SN</AvatarFallback>
                  </Avatar>
                  <div className='grid flex-1 text-start text-sm leading-tight'>
                    <span className='truncate text-xs'>{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <Sparkles />
                  Upgrade to Pro
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Settings
              </DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link to='/settings'>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to='/settings/appearance'>
                    <Palette className="mr-2 h-4 w-4" />
                    Appearance
                  </Link>
                </DropdownMenuItem>
                {!isPatient && (
                  <DropdownMenuItem asChild>
                    <Link to='/settings/branches'>
                      <MapPin className="mr-2 h-4 w-4" />
                      Branches
                    </Link>
                  </DropdownMenuItem>
                )}
                {isDoctor && (
                  <DropdownMenuItem asChild>
                    <Link to='/settings/my-invitations'>
                      <Building2 className="mr-2 h-4 w-4" />
                      My Invitations
                    </Link>
                  </DropdownMenuItem>
                )}
                {canInviteDoctors && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Facility Management
                    </DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link to='/settings/invite-doctor'>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Invite Doctor
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to='/settings/invitations'>
                        <Mail className="mr-2 h-4 w-4" />
                        Invitations
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to='/settings/branch-doctors'>
                        <Users className="mr-2 h-4 w-4" />
                        Branch Doctors
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant='destructive'
                onClick={() => setOpen(true)}
              >
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
