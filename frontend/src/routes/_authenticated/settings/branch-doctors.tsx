import { createFileRoute } from '@tanstack/react-router'
import { BranchDoctorsPage } from '@/features/settings/branch-doctors'

export const Route = createFileRoute('/_authenticated/settings/branch-doctors')({
  component: BranchDoctorsRoute,
})

function BranchDoctorsRoute() {
  return <BranchDoctorsPage />
}
