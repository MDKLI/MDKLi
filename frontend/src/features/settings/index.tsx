import { Outlet } from '@tanstack/react-router'
import { SidebarNav } from './components/sidebar-nav'
import {
  User,
  Palette,
  MapPin,
  Building2,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

export function Settings() {
  const { auth } = useAuthStore()
  const userRole = auth.user?.role || ''
  const isDoctor = userRole === 'doctor'
  const isFacility = userRole === 'clinic_admin' || userRole === 'pharmacy_admin'
  
  // Build sidebar items based on role
  const sidebarNavItems = [
    {
      title: 'Personal Info',
      href: '/settings',
      icon: <User size={18} />,
    },
    {
      title: 'Appearance',
      href: '/settings/appearance',
      icon: <Palette size={18} />,
    },
  ]
  
  // Add Branches tab for doctors and facilities
  if (isDoctor || isFacility) {
    sidebarNavItems.push({
      title: 'Branches',
      href: '/settings/branches',
      icon: <MapPin size={18} />,
    })
  }
  
  // Facility management moved to dropdown menu
  // Invite Doctor, Invitations, and Branch Doctors are now in the user dropdown
  
  // Add Doctor Invitations tab for doctors
  if (isDoctor) {
    sidebarNavItems.push({
      title: 'My Invitations',
      href: '/settings/my-invitations',
      icon: <Building2 size={18} />,
    })
  }
  
  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-8 md:flex-row md:gap-12 px-4 md:px-8 lg:px-12'>
        <aside className='w-full md:w-48'>
          <SidebarNav items={sidebarNavItems} />
        </aside>
        <div className='flex-1 md:max-w-2xl'>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
