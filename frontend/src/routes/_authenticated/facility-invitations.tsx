import { createFileRoute } from '@tanstack/react-router'
import { FacilityInvitationsPage } from '@/features/settings/facility-invitations'

export const Route = createFileRoute('/_authenticated/facility-invitations')({
  component: FacilityInvitationsPage,
})
