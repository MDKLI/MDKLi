interface Props {
  children: React.ReactNode
}

export function AuthLayout({ children }: Props) {
  return (
    <div className='min-h-svh bg-background flex flex-col items-center justify-center p-6 md:p-10'>
      {/* Page content (card, form, etc.) */}
      <div className='w-full max-w-md mx-auto'>
        {children}
      </div>
    </div>
  )
}
