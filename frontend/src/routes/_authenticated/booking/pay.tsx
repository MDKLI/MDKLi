import { useState } from 'react'
import { createFileRoute, useSearch, useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CreditCard, Lock, Clock, Calendar, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import moment from 'moment'
import { bookingApi } from '@/lib/api'

type PaySearch = {
  appointmentId?: string
  amount?: number
  branchName?: string
  date?: string
  startTime?: string
  endTime?: string
}

export const Route = createFileRoute('/_authenticated/booking/pay')({
  validateSearch: (search: Record<string, unknown>): PaySearch => ({
    appointmentId: typeof search.appointmentId === 'string' ? search.appointmentId : undefined,
    amount: typeof search.amount === 'number' ? search.amount : Number(search.amount) || undefined,
    branchName: typeof search.branchName === 'string' ? search.branchName : undefined,
    date: typeof search.date === 'string' ? search.date : undefined,
    startTime: typeof search.startTime === 'string' ? search.startTime : undefined,
    endTime: typeof search.endTime === 'string' ? search.endTime : undefined,
  }),
  component: FakePaymentPage,
})

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 19)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

function formatCvc(value: string) {
  return value.replace(/\D/g, '').slice(0, 4)
}

function detectBrand(cardNumber: string) {
  const digits = cardNumber.replace(/\D/g, '')
  if (/^4/.test(digits)) return 'Visa'
  if (/^5[1-5]/.test(digits)) return 'Mastercard'
  if (/^3[47]/.test(digits)) return 'Amex'
  return 'Card'
}

const formatTime12Hour = (time?: string) => {
  if (!time) return ''
  return moment(time, 'HH:mm').format('hh:mm A')
}

function FakePaymentPage() {
  const { appointmentId, amount, branchName, date, startTime, endTime } = useSearch({
    from: '/_authenticated/booking/pay',
  })
  const navigate = useNavigate()

  const [cardholderName, setCardholderName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [loading, setLoading] = useState(false)

  const digitsOnly = cardNumber.replace(/\D/g, '')
  const cardValid = digitsOnly.length >= 12
  const expiryValid = /^\d{2}\/\d{2}$/.test(expiry)
  const cvcValid = cvc.length >= 3
  const nameValid = cardholderName.trim().length > 1
  const formValid = cardValid && expiryValid && cvcValid && nameValid

  const handlePay = async () => {
    if (!appointmentId) {
      toast.error('Missing appointment')
      return
    }
    if (!formValid) {
      toast.error('Please fill in all fields correctly')
      return
    }
    setLoading(true)
    try {
      const result = await bookingApi.confirmFakePayment(appointmentId, {
        cardholderName, cardNumber: digitsOnly, expiry, cvc,
      })
      if (result.error || !result.data?.success) {
        toast.error(result.error || 'Payment failed')
        return
      }
      navigate({ to: '/booking/payment-result', search: { appointmentId } })
    } catch {
      toast.error('Payment failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            Complete Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Booking summary */}
          {(branchName || date || startTime) && (
            <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
              {branchName && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{branchName}</span>
                </div>
              )}
              {date && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{moment(date).format('dddd, D MMMM YYYY')}</span>
                </div>
              )}
              {startTime && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime12Hour(startTime)} - {formatTime12Hour(endTime)}</span>
                </div>
              )}
            </div>
          )}

          {/* Amount due */}
          <div className="flex items-center justify-between border rounded-lg p-4">
            <span className="text-sm text-muted-foreground">Amount due</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold">{amount ?? '--'}</span>
              <span className="text-sm text-muted-foreground">EGP</span>
            </div>
          </div>

          {/* Pending notice */}
          <Badge variant="outline" className="w-full justify-center py-1.5 text-xs font-normal">
            Booking on hold — confirmed only after payment
          </Badge>

          {/* Live card preview */}
          <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white p-5 space-y-6 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div className="h-8 w-11 rounded-md bg-gradient-to-br from-yellow-200 to-yellow-500 opacity-90" />
              <span className="text-xs font-medium tracking-wide opacity-80">
                {detectBrand(cardNumber)}
              </span>
            </div>
            <p className="text-lg tracking-widest font-mono">
              {cardNumber || '•••• •••• •••• ••••'}
            </p>
            <div className="flex justify-between text-xs opacity-80">
              <span className="uppercase">{cardholderName || 'CARDHOLDER NAME'}</span>
              <span>{expiry || 'MM/YY'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardholderName">Cardholder Name</Label>
            <Input
              id="cardholderName"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder="John Doe"
              autoComplete="cc-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input
              id="cardNumber"
              inputMode="numeric"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="4242 4242 4242 4242"
              autoComplete="cc-number"
              maxLength={23}
            />
          </div>

          <div className="flex gap-4">
            <div className="space-y-2 flex-1">
              <Label htmlFor="expiry">Expiry</Label>
              <Input
                id="expiry"
                inputMode="numeric"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                placeholder="MM/YY"
                autoComplete="cc-exp"
                maxLength={5}
              />
            </div>
            <div className="space-y-2 flex-1">
              <Label htmlFor="cvc">CVC</Label>
              <Input
                id="cvc"
                inputMode="numeric"
                value={cvc}
                onChange={(e) => setCvc(formatCvc(e.target.value))}
                placeholder="123"
                autoComplete="cc-csc"
                maxLength={4}
              />
            </div>
          </div>

          <Button className="w-full" onClick={handlePay} disabled={loading || !formValid}>
            {loading ? 'Processing...' : amount ? `Pay ${amount} EGP` : 'Pay'}
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            This is a demo checkout. No real payment is processed.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
