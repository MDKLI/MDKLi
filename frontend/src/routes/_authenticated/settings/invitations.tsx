import { createFileRoute } from '@tanstack/react-router'
import { FacilityInvitationsPage } from '@/features/settings/facility-invitations'

export const Route = createFileRoute('/_authenticated/settings/invitations')({
  component: InvitationsRoute,
})

function InvitationsRoute() {
  return <FacilityInvitationsPage />
}
