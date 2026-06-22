import { createFileRoute } from '@tanstack/react-router'
import { InviteDoctorPage } from '@/features/settings/invite-doctor'

export const Route = createFileRoute('/_authenticated/settings/invite-doctor')({
  component: InviteDoctorRoute,
})

function InviteDoctorRoute() {
  return <InviteDoctorPage />
}
