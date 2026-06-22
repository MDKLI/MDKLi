import { createFileRoute } from '@tanstack/react-router'
import { DoctorInvitationsPage } from '@/features/invitations'

export const Route = createFileRoute('/_authenticated/settings/my-invitations')({
  component: MyInvitationsRoute,
})

function MyInvitationsRoute() {
  return <DoctorInvitationsPage />
}
