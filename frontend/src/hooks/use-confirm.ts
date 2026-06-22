import { useState, useCallback } from 'react'

interface ConfirmOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean
  resolve: ((value: boolean) => void) | null
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    destructive: false,
    resolve: null,
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        ...options,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        destructive: options.destructive || false,
        isOpen: true,
        resolve,
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    if (state.resolve) {
      state.resolve(true)
    }
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }))
  }, [state.resolve])

  const handleCancel = useCallback(() => {
    if (state.resolve) {
      state.resolve(false)
    }
    setState((prev) => ({ ...prev, isOpen: false, resolve: null }))
  }, [state.resolve])

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      handleCancel()
    }
  }, [handleCancel])

  return {
    confirm,
    state,
    handleConfirm,
    handleCancel,
    handleOpenChange,
  }
}
