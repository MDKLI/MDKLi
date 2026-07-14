import { createFileRoute } from '@tanstack/react-router'
import { Main } from '@/components/layout/main'
import { UsersTable } from '@/features/admin/users/users-table'

export const Route = createFileRoute('/_authenticated/admin/users')({
  component: AdminUsers,
})

function AdminUsers() {
  return (
    <Main className="flex flex-1 flex-col gap-4 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">
            Manage users, suspend accounts, and view profiles
          </p>
        </div>
      </div>
      <UsersTable />
    </Main>
  )
}
