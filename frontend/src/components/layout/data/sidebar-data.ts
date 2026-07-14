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
  ShieldCheck,
  BarChart3,
  FileText,
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

    {
      title: 'Admin',
      items: [
        {
          title: 'Dashboard',
          url: '/admin/dashboard',
          icon: Home,
        },
        {
          title: 'Verification',
          url: '/admin/verification',
          icon: ShieldCheck,
        },
        {
          title: 'Chats',
          url: '/chats',
          icon: MessagesSquare,
        },
        {
          title: 'Users',
          url: '/admin/users',
          icon: Users,
        },
        {
          title: 'Appointments',
          url: '/admin/appointments',
          icon: CalendarClock,
        },
        {
          title: 'Tickets',
          url: '/admin/tickets',
          icon: MessagesSquare,
        },
        {
          title: 'Analytics',
          url: '/admin/analytics',
          icon: BarChart3,
        },
        {
          title: 'Audit Logs',
          url: '/admin/audit-logs',
          icon: FileText,
        },
      ],
    },

  ],
}

// Helper function to get profile menu items based on user role
export function getProfileMenuItems(role: string | undefined) {
  const isDoctor = role === 'doctor'
  const isFacility = role === 'clinic_admin' || role === 'pharmacy_admin'
  const isAdmin = role === 'admin' || role === 'superadmin'
  
  // Admin users get minimal profile menu - no Branches, no Wishlist
  if (isAdmin) {
    return [
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
  }
  
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
    {
      title: 'Availability',
      url: '/facility-availability',
      icon: CalendarClock,
    },
  ]
}
