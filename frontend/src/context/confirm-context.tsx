import React, { createContext, useContext, useState, useCallback } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface ConfirmOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    isOpen: boolean
    options: ConfirmOptions
    resolve: ((value: boolean) => void) | null
  }>({
    isOpen: false,
    options: {
      title: '',
      description: '',
    },
    resolve: null,
  })

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        options,
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

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        open={state.isOpen}
        onOpenChange={(open) => {
          if (!open) handleCancel()
        }}
        title={state.options.title}
        desc={state.options.description}
        confirmText={state.options.confirmText || 'Confirm'}
        cancelBtnText={state.options.cancelText || 'Cancel'}
        destructive={state.options.destructive}
        handleConfirm={handleConfirm}
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirmDialog() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmProvider')
  }
  return context
}
