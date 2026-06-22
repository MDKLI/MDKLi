import { ConfirmDialog } from '@/components/confirm-dialog'
import { useConfirm } from '@/hooks/use-confirm'

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const { state, handleConfirm, handleOpenChange } = useConfirm()

  return (
    <>
      {children}
      <ConfirmDialog
        open={state.isOpen}
        onOpenChange={handleOpenChange}
        title={state.title}
        desc={state.description}
        confirmText={state.confirmText}
        cancelBtnText={state.cancelText}
        destructive={state.destructive}
        handleConfirm={handleConfirm}
      />
    </>
  )
}
