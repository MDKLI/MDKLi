import { useEffect, useState } from 'react'
import { createFileRoute, useSearch, Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { bookingApi } from '@/lib/api'

type PaymentResultSearch = {
  appointmentId?: string
}

export const Route = createFileRoute('/_authenticated/booking/payment-result')({
  validateSearch: (search: Record<string, unknown>): PaymentResultSearch => ({
    appointmentId: typeof search.appointmentId === 'string' ? search.appointmentId : undefined,
  }),
  component: PaymentResultPage,
})

type ResultState = 'polling' | 'success' | 'failed' | 'error'

function PaymentResultPage() {
  const { appointmentId } = useSearch({ from: '/_authenticated/booking/payment-result' })
  const [state, setState] = useState<ResultState>('polling')

  useEffect(() => {
    if (!appointmentId) {
      setState('error')
      return
    }

    let cancelled = false
    let attempts = 0
    const maxAttempts = 15 // ~30s at 2s interval

    const poll = async () => {
      attempts += 1
      const result = await bookingApi.getPaymentStatus(appointmentId)

      if (cancelled) return

      if (result.error || !result.data?.success) {
        if (attempts >= maxAttempts) setState('error')
        else setTimeout(poll, 2000)
        return
      }

      const status = result.data.data.status
      if (status === 'PENDING' || status === 'CONFIRMED') {
        setState('success')
      } else if (status === 'PAYMENT_FAILED') {
        setState('failed')
      } else if (attempts >= maxAttempts) {
        // still PENDING_PAYMENT after max attempts - webhook may be delayed
        setState('error')
      } else {
        setTimeout(poll, 2000)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [appointmentId])

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Booking Payment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 text-center py-6">
          {state === 'polling' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Confirming your payment with Paymob...</p>
            </>
          )}

          {state === 'success' && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <div>
                <p className="font-medium">Payment successful</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your booking is now pending doctor confirmation.
                </p>
              </div>
              <Button asChild>
                <Link to="/booking">View My Bookings</Link>
              </Button>
            </>
          )}

          {state === 'failed' && (
            <>
              <XCircle className="h-12 w-12 text-red-600" />
              <div>
                <p className="font-medium">Payment failed</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The slot has been released. Please try booking again.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to="/booking">Back to Booking</Link>
              </Button>
            </>
          )}

          {state === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-medium">Couldn't confirm payment status</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Check "My Bookings" in a moment, or contact support if this persists.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to="/booking">Go to My Bookings</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
