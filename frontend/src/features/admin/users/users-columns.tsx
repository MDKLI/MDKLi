import { type ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { LongText } from '@/components/long-text'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useState } from 'react'

export const usersColumns: ColumnDef<any>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-0.5"
      />
    ),
    meta: {
      className: cn('inset-s-0 z-10 rounded-tl-[inherit] max-md:sticky'),
    },
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-0.5"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'username',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Username" />
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={row.original.avatar} alt={row.original.name} />
          <AvatarFallback>
            {row.original.name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <LongText className="max-w-36 ps-3">{row.getValue('username')}</LongText>
      </div>
    ),
    meta: {
      className: cn(
        'drop-shadow-[0_1px_2px_rgb(0_0_0_/_0.1)] dark:drop-shadow-[0_1px_2px_rgb(255_255_255_/_0.1)]',
        'inset-s-6 ps-0.5 max-md:sticky @4xl/content:table-cell @4xl/content:drop-shadow-none'
      ),
    },
    enableHiding: false,
  },
  {
    id: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => <LongText className="max-w-36">{row.original.name}</LongText>,
    meta: { className: 'w-36' },
  },
  {
    accessorKey: 'email',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => <div className="w-fit ps-2 text-nowrap">{row.original.email}</div>,
  },
  {
    accessorKey: 'role',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => {
      const role = row.original.role as keyof typeof roleColors
      const roleColors = {
        patient: 'bg-sky-100/30 text-sky-900 dark:text-sky-200',
        doctor: 'bg-emerald-100/30 text-emerald-900 dark:text-emerald-200',
        clinic_admin: 'bg-purple-100/30 text-purple-900 dark:text-purple-200',
        pharmacy_admin: 'bg-amber-100/30 text-amber-900 dark:text-amber-200',
        admin: 'bg-blue-100/30 text-blue-900 dark:text-blue-200',
        superadmin: 'bg-indigo-100/30 text-indigo-900 dark:text-indigo-200',
      }
      return (
        <Badge variant="outline" className={cn('capitalize', roleColors[role] || '')}>
          {row.getValue('role')}
        </Badge>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    enableHiding: false,
    enableSorting: false,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.status as keyof typeof statusColors
      const statusColors = {
        active: 'bg-teal-100/30 text-teal-900 dark:text-teal-200',
        suspended: 'bg-destructive/10 dark:bg-destructive/50 text-destructive dark:text-primary',
        pending: 'bg-neutral-300/40 border-neutral-300',
        verified: 'bg-emerald-100/30 text-emerald-900 dark:text-emerald-200',
      }
      return (
        <Badge variant="outline" className={cn('capitalize', statusColors[status] || '')}>
          {status}
        </Badge>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    enableHiding: false,
    enableSorting: false,
  },
  {
    id: 'actions',
    cell: ({ row }) => <UserActionsRow row={row} />,
  },
]

function UserActionsRow({ row }: { row: any }) {
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [reason, setReason] = useState('')

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => console.log('View profile')}>
        View
      </Button>
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm">
            {row.original.status === 'active' ? 'Suspend' : 'Unsuspend'}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{row.original.status === 'active' ? 'Suspend User' : 'Unsuspend User'}</DialogTitle>
            <DialogDescription>
              {row.original.status === 'active' ? 'Are you sure you want to suspend this user?' : 'Are you sure you want to unsuspend this user?'}
            </DialogDescription>
          </DialogHeader>
          {row.original.status === 'active' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter suspension reason..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSuspendDialogOpen(false)
                    setReason('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    console.log('Suspend:', row.original.id, 'Reason:', reason)
                    setSuspendDialogOpen(false)
                    setReason('')
                  }}
                >
                  Confirm
                </Button>
              </div>
            </div>
          )}
          {row.original.status !== 'active' && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSuspendDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  console.log('Unsuspend:', row.original.id)
                  setSuspendDialogOpen(false)
                }}
              >
                Confirm
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
