import {
  Home,
  BookMarked,
  CalendarDays,
  MessagesSquare,
  User,
  Building2,
  HelpCircle,
  BrainCircuit,
  MapPin,
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
          url: '/_authenticated/dashboard',
          icon: Home,
        },
        {
          title: 'Bookings',
          url: '/tasks',
          icon: BookMarked,
        },
        {
          title: 'Chats',
          url: '/chats',
          badge: '3',
          icon: MessagesSquare,
        },
        {
          title: 'Calendar',
          url: '/users',
          icon: CalendarDays,
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
