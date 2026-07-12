import { createFileRoute } from '@tanstack/react-router'
import { BranchDoctorsPage } from '@/features/settings/branch-doctors'

export const Route = createFileRoute('/_authenticated/branch-doctors')({
  component: BranchDoctorsPage,
})
