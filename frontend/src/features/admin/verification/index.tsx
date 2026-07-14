import { Outlet } from '@tanstack/react-router'
import { Main } from '@/components/layout/main'
import { VerificationTabs } from './verification-tabs'

export function AdminVerification() {
  return (
    <Main className="flex flex-1 flex-col gap-4 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Verification Queue</h2>
          <p className="text-muted-foreground">
            Approve or reject doctor and facility registrations
          </p>
        </div>
      </div>
      <VerificationTabs />
      <Outlet />
    </Main>
  )
}

