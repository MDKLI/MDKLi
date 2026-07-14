import { Main } from '@/components/layout/main'
import { Dashboard as DashboardContent } from './dashboard'

export function AdminDashboard() {
  return (
    <Main className="flex flex-1 flex-col gap-4 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of your platform's performance and activity
          </p>
        </div>
      </div>
      <DashboardContent />
    </Main>
  )
}

