import { createFileRoute } from '@tanstack/react-router'
import PaymentSettings from '@/features/settings/payment'

export const Route = createFileRoute('/_authenticated/settings/payment')({
  component: PaymentSettings,
})
