import {
  Home,
  BookMarked,
  MessagesSquare,
  User,
  Building2,
  HelpCircle,
  BrainCircuit,
  MapPin,
  CalendarClock,
  Mail,
  UserPlus,
  Users,
} from 'lucide-react'

import { type SidebarData } from '../types'

// This is the static sidebar data
// User info will be dynamically updated in the component
export const sidebarData: SidebarData = {
  user: {
    name: 'Loading...',
    email: 'Loading...',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'MDKLI',
      logo: Home,
      plan: 'Healthcare Platform',
    },
  ],
  navGroups: [
    {
      title: 'General',
      items: [
        {
          title: 'Dashboard',
          url: '/dashboard',
          icon: Home,
        },
        {
          title: 'Bookings',
          url: '/booking',
          icon: BookMarked,
        },
        {
          title: 'Chats',
          url: '/chats',
          badge: '3',
          icon: MessagesSquare,
        },
        {
          title: 'AI Assistant',
          url: '/ai',
          icon: BrainCircuit,
        },
      ],
    },

    {
      title: 'Other',
      items: [
        {
          title: 'Help Center',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}

// Helper function to get profile menu items based on user role
export function getProfileMenuItems(role: string | undefined) {
  const isDoctor = role === 'doctor'
  const isFacility = role === 'clinic_admin' || role === 'pharmacy_admin'
  
  const items = [
    {
      title: 'Personal Info',
      url: '/settings',
      icon: User,
    },
    {
      title: 'Account',
      url: '/settings/account',
      icon: Building2,
    },
  ]
  
  // Add Branches tab only for doctors and facilities
  if (isDoctor || isFacility) {
    items.push({
      title: 'Branches',
      url: '/settings/branches',
      icon: MapPin,
    })
  }
  
  return items
}

// Helper function to get doctor-specific sidebar items
export function getDoctorSidebarItems(role: string | undefined) {
  const isDoctor = role === 'doctor'
  
  if (!isDoctor) {
    return []
  }
  
  return [
    {
      title: 'Availability',
      url: '/availability',
      icon: CalendarClock,
    },
    {
      title: 'My Invitations',
      url: '/my-invitations',
      icon: Mail,
    },
  ]
}

// Helper function to get facility-specific sidebar items (hospitals/medical centers only)
export function getFacilitySidebarItems(role: string | undefined) {
  const isFacility = role === 'clinic_admin'

  if (!isFacility) {
    return []
  }

  return [
    {
      title: 'Invite Doctor',
      url: '/invite-doctor',
      icon: UserPlus,
    },
    {
      title: 'My Invitations',
      url: '/facility-invitations',
      icon: Mail,
    },
    {
      title: 'Branch Doctors',
      url: '/branch-doctors',
      icon: Users,
    },
  ]
}
