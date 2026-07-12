import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { MapPin, Plus, Settings, CheckCircle, AlertCircle, Building2, Clock, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/auth-store'
import { Link } from '@tanstack/react-router'
import { bookingApi, profileApi } from '@/lib/api'
import { Input } from '@/components/ui/input'
import moment from 'moment'

// Type declarations for moment
declare module 'moment' {
  interface Moment {
    clone(): Moment
    startOf(unit: string): Moment
    endOf(unit: string): Moment
    add(amount: number, unit: string): Moment
    subtract(amount: number, unit: string): Moment
    format(format: string): string
  }
}

interface Branch {
  id: string
  name: string
  address: string
  city: string
  area: string
}

interface TimeSlot {
  id: string
  startTime: string
  endTime: string
}

interface DaySchedule {
  enabled: boolean
  slots: TimeSlot[]
}

interface WeeklySchedule {
  [key: number]: DaySchedule // 0 = Sunday, 1 = Monday, etc.
}

interface BlockOutDate {
  id: string
  date: string
  reason?: string
}

interface Session {
  id: string
  patientName: string
  patientEmail: string
  date: string
  startTime: string
  endTime: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  createdAt: string
  branchId: string
  notes?: string
  branch?: {
    id: string
    name: string
  }
}

interface DoctorSettings {
  doctor_id: string
  auto_accept_bookings: boolean
  notice_period_hours: number
  daily_booking_limit: number | null
  weekly_booking_limit: number | null
  default_slot_duration_minutes: number
  allow_same_day_bookings: boolean
  buffer_time_minutes: number
  max_advance_booking_days: number
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'SUN' },
  { value: 1, label: 'Monday', short: 'MON' },
  { value: 2, label: 'Tuesday', short: 'TUE' },
  { value: 3, label: 'Wednesday', short: 'WED' },
  { value: 4, label: 'Thursday', short: 'THU' },
  { value: 5, label: 'Friday', short: 'FRI' },
  { value: 6, label: 'Saturday', short: 'SAT' },
]

const NOTICE_PERIOD_OPTIONS = [
  { value: 0, label: 'Same day' },
  { value: 1, label: '1 hour' },
  { value: 2, label: '2 hours' },
  { value: 4, label: '4 hours' },
  { value: 8, label: '8 hours' },
  { value: 12, label: '12 hours' },
  { value: 24, label: '24 hours' },
  { value: 48, label: '48 hours' },
  { value: 72, label: '3 days' },
  { value: 168, label: '1 week' },
]

// Generate time options for dropdown
const generateTimeOptions = () => {
  const times = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const hourStr = hour.toString().padStart(2, '0')
      const minStr = minute.toString().padStart(2, '0')
      const timeValue = `${hourStr}:${minStr}`
      const ampm = hour < 12 ? 'AM' : 'PM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      const displayTime = `${displayHour}:${minStr} ${ampm}`
      times.push({ value: timeValue, label: displayTime })
    }
  }
  return times
}

const TIME_OPTIONS = generateTimeOptions()

const createDefaultWeeklySchedule = (): WeeklySchedule => {
  const defaultSchedule: WeeklySchedule = {}
  DAYS_OF_WEEK.forEach(day => {
    defaultSchedule[day.value] = {
      enabled: day.value >= 1 && day.value <= 5,
      slots: day.value >= 1 && day.value <= 5
        ? [{ id: `default-${day.value}`, startTime: '09:00', endTime: '17:00' }]
        : [],
    }
  })
  return defaultSchedule
}

const formatTime12Hour = (time: string) => {
  if (!time) return ''
  return moment(time, 'HH:mm').format('hh:mm A')
}

export function AvailabilitySettings() {
  const { auth } = useAuthStore()
  const doctorId = auth.user?.id
  
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [loading, setLoading] = useState(false)
  
  // Doctor Settings
  const [settings, setSettings] = useState<DoctorSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [editingLimits, setEditingLimits] = useState(false)
  
  // Weekly schedule - each day can have multiple time slots
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(createDefaultWeeklySchedule)
  
  // Block out dates
  const [blockOutDates, setBlockOutDates] = useState<BlockOutDate[]>([])
  const [selectedBlockOutDates, setSelectedBlockOutDates] = useState<Date[]>([])
  const [blockOutCalendarMonth, setBlockOutCalendarMonth] = useState(moment())
  const [isBlockOutDialogOpen, setIsBlockOutDialogOpen] = useState(false)
  
  // Sessions state - defined in SessionsTabContent component
  
  useEffect(() => {
    if (doctorId) {
      fetchBranches()
      fetchSettings()
    }
  }, [doctorId])

  useEffect(() => {
    if (!selectedBranch) {
      setWeeklySchedule(createDefaultWeeklySchedule())
      setBlockOutDates([])
      return
    }
    void loadBranchSchedule(selectedBranch)
    void loadBlockOutDates(selectedBranch)
  }, [selectedBranch])
  
  const fetchSettings = async () => {
    if (!doctorId) return
    
    try {
      setSettingsLoading(true)
      console.log('Fetching settings for doctorId:', doctorId)
      const result = await bookingApi.getDoctorSettings(doctorId)
      console.log('Settings result:', result)
      
      if (result.data && result.data.success) {
        console.log('Setting settings to:', result.data.data)
        setSettings(result.data.data)
      } else {
        console.log('No settings found, using defaults')
        setSettings({
          doctor_id: doctorId,
          auto_accept_bookings: false,
          notice_period_hours: 24,
          daily_booking_limit: null,
          weekly_booking_limit: null,
          default_slot_duration_minutes: 30,
          allow_same_day_bookings: true,
          buffer_time_minutes: 0,
          max_advance_booking_days: 90,
        })
      }
    } catch (error) {
      setSettings({
        doctor_id: doctorId,
        auto_accept_bookings: false,
        notice_period_hours: 24,
        daily_booking_limit: null,
        weekly_booking_limit: null,
        default_slot_duration_minutes: 30,
        allow_same_day_bookings: true,
        buffer_time_minutes: 0,
        max_advance_booking_days: 90,
      })
    } finally {
      setSettingsLoading(false)
    }
  }
  
  const updateSettings = async (updates: Partial<DoctorSettings>) => {
    console.log('updateSettings called with doctorId:', doctorId, 'updates:', updates)
    if (!doctorId || !settings) {
      console.log('Early return - doctorId:', doctorId, 'settings:', settings)
      return
    }
    
    try {
      const result = await bookingApi.updateDoctorSettings(doctorId, updates)
      console.log('updateSettings result:', result)
      
      if (result.data && result.data.success) {
        setSettings({ ...settings, ...result.data.data })
        toast.success('Settings updated successfully')
      } else {
        console.error('Failed to update settings:', result)
        toast.error('Failed to update settings')
      }
    } catch (error) {
      console.error('Error updating settings:', error)
      toast.error('Failed to update settings')
    }
  }
  
  const saveBookingLimits = async () => {
    if (!doctorId || !settings) return
    
    await updateSettings({
      daily_booking_limit: settings.daily_booking_limit,
      weekly_booking_limit: settings.weekly_booking_limit,
    })
    setEditingLimits(false)
  }
  
  const fetchBranches = async () => {
    try {
      const result = await profileApi.getProfile()
      
      const profileData = result.data as any
      if (profileData && profileData.branches && profileData.branches.length > 0) {
        const transformedBranches = profileData.branches.map((branch: any) => ({
          id: branch.id,
          name: branch.name,
          address: branch.address || '',
          city: branch.city || '',
          area: branch.area || '',
        }))
        setBranches(transformedBranches)
      } else {
        setBranches([])
      }
    } catch (error) {
      toast.error('Failed to fetch branches')
      setBranches([])
    }
  }

  const loadBranchSchedule = async (branchId: string) => {
    try {
      const result = await bookingApi.getDoctorBranchAvailability(branchId)
      if (result.error || !result.data?.success) {
        setWeeklySchedule(createDefaultWeeklySchedule())
        return
      }

      const schedule: WeeklySchedule = {}
      DAYS_OF_WEEK.forEach(day => {
        schedule[day.value] = { enabled: false, slots: [] }
      })

      for (const rule of result.data.data) {
        const day = Number(rule.dayOfWeek)
        if (Number.isNaN(day) || !schedule[day]) continue
        schedule[day].enabled = true
        schedule[day].slots.push({
          id: rule.id || `${day}-${rule.startTime}-${rule.endTime}`,
          startTime: rule.startTime,
          endTime: rule.endTime,
        })
      }

      setWeeklySchedule(schedule)
    } catch {
      setWeeklySchedule(createDefaultWeeklySchedule())
    }
  }

  const loadBlockOutDates = async (branchId: string) => {
    try {
      const result = await bookingApi.getDoctorBranchOverrides(branchId)
      if (result.error || !result.data?.success) {
        setBlockOutDates([])
        return
      }

      const mapped = (result.data.data || [])
        .filter((override: any) => override.type === 'BLOCK')
        .map((override: any) => ({
          id: override.id,
          date: moment(override.date).format('YYYY-MM-DD'),
          reason: override.reason || undefined,
        }))

      setBlockOutDates(mapped)
    } catch {
      setBlockOutDates([])
    }
  }
  
  // Schedule management functions
  const toggleDay = (dayValue: number) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [dayValue]: {
        ...prev[dayValue],
        enabled: !prev[dayValue].enabled
      }
    }))
  }
  
  const addTimeSlot = (dayValue: number) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [dayValue]: {
        ...prev[dayValue],
        slots: [
          ...prev[dayValue].slots,
          { id: `${dayValue}-${Date.now()}`, startTime: '09:00', endTime: '17:00' }
        ]
      }
    }))
  }
  
  const removeTimeSlot = (dayValue: number, slotId: string) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [dayValue]: {
        ...prev[dayValue],
        slots: prev[dayValue].slots.filter(slot => slot.id !== slotId)
      }
    }))
  }
  
  const updateTimeSlot = (dayValue: number, slotId: string, field: 'startTime' | 'endTime', value: string) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [dayValue]: {
        ...prev[dayValue],
        slots: prev[dayValue].slots.map(slot =>
          slot.id === slotId ? { ...slot, [field]: value } : slot
        )
      }
    }))
  }
  
  const saveSchedule = async () => {
    if (!selectedBranch || !doctorId) {
      toast.error('Please select a branch first')
      return
    }

    try {
      setLoading(true)

      const rules: Array<{ dayOfWeek: number; startTime: string; endTime: string; slotDurationMinutes: number }> = []
      for (const day of DAYS_OF_WEEK) {
        const daySchedule = weeklySchedule[day.value]
        if (!daySchedule.enabled || daySchedule.slots.length === 0) continue

        for (const slot of daySchedule.slots) {
          if (slot.startTime >= slot.endTime) {
            toast.error(`Invalid time range on ${day.label}`)
            return
          }
          rules.push({
            dayOfWeek: day.value,
            startTime: slot.startTime,
            endTime: slot.endTime,
            slotDurationMinutes: 30,
          })
        }
      }

      const result = await bookingApi.replaceDoctorBranchAvailability(selectedBranch, {
        doctorId,
        rules,
      })

      if (result.error || !result.data?.success) {
        toast.error(result.error || 'Failed to save schedule')
        return
      }

      toast.success('Schedule saved successfully')
      return

      // Delete all existing rules for this branch first, then recreate
      // We do this by fetching existing rules and replacing them
      const BOOKING_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const token = JSON.parse(document.cookie.match(/thisisjustarandomstring=([^;]+)/)?.[1] || '""')

      // For each enabled day, create availability rules
      for (const day of DAYS_OF_WEEK) {
        const daySchedule = weeklySchedule[day.value]
        if (!daySchedule.enabled || daySchedule.slots.length === 0) continue

        for (const slot of daySchedule.slots) {
          await fetch(`${BOOKING_URL}/api/booking/doctor/branches/${selectedBranch}/availability`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              dayOfWeek: day.value,
              startTime: slot.startTime,
              endTime: slot.endTime,
              slotDurationMinutes: 30,
              doctorId,
            }),
          })
        }
      }

      toast.success('Schedule saved successfully')
    } catch (error) {
      toast.error('Failed to save schedule')
    } finally {
      setLoading(false)
    }
  }
  
  // Block out dates functions
  const toggleBlockOutDate = (date: Date) => {
    const dateStr = moment(date).format('YYYY-MM-DD')
    const isSelected = selectedBlockOutDates.some(d => moment(d).format('YYYY-MM-DD') === dateStr)
    
    if (isSelected) {
      setSelectedBlockOutDates(prev => prev.filter(d => moment(d).format('YYYY-MM-DD') !== dateStr))
    } else {
      setSelectedBlockOutDates(prev => [...prev, date])
    }
  }
  
  const addBlockOutDates = async () => {
    if (!selectedBranch || selectedBlockOutDates.length === 0) return

    try {
      const existingDates = new Set(blockOutDates.map(d => d.date))
      const uniqueDates = selectedBlockOutDates
        .map(date => moment(date).format('YYYY-MM-DD'))
        .filter(date => !existingDates.has(date))

      for (const date of uniqueDates) {
        await bookingApi.createDoctorBranchOverride(selectedBranch, {
          date,
          type: 'BLOCK',
        })
      }

      await loadBlockOutDates(selectedBranch)
      setSelectedBlockOutDates([])
      setIsBlockOutDialogOpen(false)
      toast.success('Block out dates added')
    } catch {
      toast.error('Failed to add block out dates')
    }
  }
  
  const removeBlockOutDate = async (overrideId: string) => {
    if (!selectedBranch) return
    try {
      const result = await bookingApi.deleteDoctorBranchOverride(selectedBranch, overrideId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setBlockOutDates(prev => prev.filter(d => d.id !== overrideId))
      toast.success('Block out date removed')
    } catch {
      toast.error('Failed to remove block out date')
    }
  }
  
  // Generate calendar days for the current month view
  const generateCalendarDays = () => {
    const startOfMonth = blockOutCalendarMonth.clone().startOf('month')
    const endOfMonth = blockOutCalendarMonth.clone().endOf('month')
    const startOfCalendar = startOfMonth.clone().startOf('week')
    const endOfCalendar = endOfMonth.clone().endOf('week')
    
    const days = []
    let day = startOfCalendar.clone()
    
    while (day.isSameOrBefore(endOfCalendar)) {
      days.push(day.clone())
      day.add(1, 'day')
    }
    
    return days
  }
  
  const calendarDays = generateCalendarDays()
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  // Sessions Tab Content Component
  const SessionsTabContent = ({ doctorId }: { doctorId?: string }) => {
    const [sessions, setSessions] = useState<Session[]>([])
    const [loading, setLoading] = useState(false)
    
    // Fetch pending sessions from API
    useEffect(() => {
      if (!doctorId) return
      
      const fetchSessions = async () => {
        setLoading(true)
        try {
          const response = await bookingApi.getPendingSessions(doctorId)
          if (response.data && response.data.success && response.data.data) {
            const mappedSessions = response.data.data.map((booking: any) => ({
              id: booking.id,
              patientName: booking.patient?.name || 'Unknown Patient',
              patientEmail: booking.patient?.email || '',
              date: booking.date,
              startTime: booking.startTime,
              endTime: booking.endTime,
              status: String(booking.status || '').toLowerCase() as Session['status'],
              createdAt: booking.createdAt,
              branchId: booking.branchId,
              notes: booking.notes,
              branch: booking.branch,
            }))
            setSessions(mappedSessions)
          }
        } catch (error) {
          toast.error('Failed to load pending sessions')
        } finally {
          setLoading(false)
        }
      }
      
      fetchSessions()
      
      // Refresh every 30 seconds to check for auto-rejected sessions
      const interval = setInterval(fetchSessions, 30000)
      return () => clearInterval(interval)
    }, [doctorId])
    
    const handleAccept = async (sessionId: string) => {
      const result = await bookingApi.acceptSession(sessionId)
      if (result.error || !result.data?.success) {
        toast.error(result.error || 'Failed to accept session')
        return
      }
      toast.success('Session accepted')
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    }
    
    const handleReject = async (sessionId: string) => {
      const result = await bookingApi.rejectSession(sessionId)
      if (result.error || !result.data?.success) {
        toast.error(result.error || 'Failed to reject session')
        return
      }
      toast.success('Session rejected')
      setSessions(prev => prev.filter(s => s.id !== sessionId))
    }

    const [rescheduleTarget, setRescheduleTarget] = useState<Session | null>(null)
    const [rescheduleDays, setRescheduleDays] = useState<Array<{ date: string; dayName: string; dayNumber: number; month: string; slots: Array<{ start_time: string; end_time: string; is_available: boolean }> }>>([])
    const [rescheduleAvailabilityLoading, setRescheduleAvailabilityLoading] = useState(false)
    const [rescheduleSelectedDate, setRescheduleSelectedDate] = useState<string | null>(null)
    const [rescheduleSelectedSlot, setRescheduleSelectedSlot] = useState<{ start_time: string; end_time: string } | null>(null)
    const [rescheduleLoading, setRescheduleLoading] = useState(false)

    const openReschedule = async (session: Session) => {
      setRescheduleTarget(session)
      setRescheduleSelectedDate(null)
      setRescheduleSelectedSlot(null)
      setRescheduleDays([])
      setRescheduleAvailabilityLoading(true)
      try {
        const result = await bookingApi.getDoctorAvailabilityForBooking(doctorId || '', session.branchId)
        if (result.data?.success) {
          setRescheduleDays(result.data.data)
        } else {
          toast.error(result.error || 'Failed to load availability')
        }
      } finally {
        setRescheduleAvailabilityLoading(false)
      }
    }

    const submitReschedule = async () => {
      if (!rescheduleTarget || !rescheduleSelectedDate || !rescheduleSelectedSlot) return

      setRescheduleLoading(true)
      const result = await bookingApi.rescheduleSession(rescheduleTarget.id, {
        booking_date: rescheduleSelectedDate,
        start_time: rescheduleSelectedSlot.start_time,
        end_time: rescheduleSelectedSlot.end_time,
      })
      setRescheduleLoading(false)

      if (result.error || !result.data?.success) {
        toast.error(result.error || 'Failed to reschedule session')
        return
      }

      toast.success('Session rescheduled — awaiting re-confirmation')
      setSessions(prev => prev.filter(s => s.id !== rescheduleTarget.id))
      setRescheduleTarget(null)
    }

    const rescheduleSelectedDay = rescheduleDays.find(d => d.date === rescheduleSelectedDate)
    
    const getTimeRemaining = (createdAt: string) => {
      const created = moment(createdAt)
      const deadline = created.clone().add(3, 'days')
      const now = moment()
      const diff = deadline.diff(now, 'hours')
      
      if (diff <= 0) return 'Expired'
      if (diff < 24) return `${diff} hours left`
      return `${Math.floor(diff / 24)} days left`
    }
    
    const pendingCount = sessions.filter(s => s.status === 'pending').length
    
    return (
      <TabsContent value="sessions" className="space-y-6">
        {/* Pending Sessions Count */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-base px-3 py-1">
              {pendingCount} Pending {pendingCount === 1 ? 'Session' : 'Sessions'}
            </Badge>
          </div>
        )}
        
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8 text-muted-foreground">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p>Loading pending sessions...</p>
              </div>
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                No Pending Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>No pending sessions to review.</p>
                <p className="text-sm mt-2">Patient booking requests will appear here.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <Card key={session.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Session Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-lg font-semibold text-primary">
                              {session.patientName.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-semibold">{session.patientName}</h4>
                            <p className="text-sm text-muted-foreground">{session.patientEmail}</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-4 mt-3">
                          <Badge variant="outline">
                            {moment(session.date).format('ddd, MMM D, YYYY')}
                          </Badge>
                          <Badge variant="outline">
                            {formatTime12Hour(session.startTime)} - {formatTime12Hour(session.endTime)}
                          </Badge>
                          {session.notes && (
                            <span className="text-sm text-muted-foreground break-words">
                              Message: {session.notes}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Time Remaining & Actions */}
                      <div className="flex flex-col items-end gap-3">
                        <Badge 
                          variant={getTimeRemaining(session.createdAt) === 'Expired' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {getTimeRemaining(session.createdAt)}
                        </Badge>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openReschedule(session)}
                          >
                            Reschedule
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleReject(session.id)}
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleAccept(session.id)}
                          >
                            Accept
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <Dialog open={!!rescheduleTarget} onOpenChange={(open) => !open && setRescheduleTarget(null)}>
          <DialogContent
            className="max-h-[85vh] overflow-y-auto overflow-x-hidden"
            style={{ width: '95vw', maxWidth: '900px' }}
          >
            <DialogHeader>
              <DialogTitle>Reschedule Session</DialogTitle>
            </DialogHeader>

            {rescheduleAvailabilityLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-muted-foreground">Loading availability...</p>
              </div>
            ) : (
              <div className="space-y-4 py-2 min-w-0">
                {/* Day picker */}
                <div className="flex flex-wrap gap-2 w-full min-w-0">
                  {rescheduleDays.map((day) => {
                    const availableSlots = day.slots.filter(s => s.is_available).length
                    const isSelected = rescheduleSelectedDate === day.date
                    return (
                      <Button
                        key={day.date}
                        variant={isSelected ? 'default' : 'outline'}
                        disabled={availableSlots === 0}
                        className={`flex-col h-auto py-3 px-4 min-w-[72px] flex-1 basis-[80px] ${isSelected ? 'ring-2 ring-primary' : ''}`}
                        onClick={() => {
                          setRescheduleSelectedDate(day.date)
                          setRescheduleSelectedSlot(null)
                        }}
                      >
                        <span className="text-xs uppercase">{day.dayName}</span>
                        <span className="text-base font-semibold">{day.dayNumber} {day.month}</span>
                        <Badge variant={availableSlots > 0 ? 'secondary' : 'outline'} className="mt-1 text-xs">
                          {availableSlots > 0 ? `${availableSlots} slots` : 'Full'}
                        </Badge>
                      </Button>
                    )
                  })}
                </div>

                {/* Slot grid */}
                {rescheduleSelectedDate && rescheduleSelectedDay ? (
                  rescheduleSelectedDay.slots.filter(s => s.is_available).length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground bg-muted rounded-lg">
                      No available slots for this date
                    </div>
                  ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full">
                      {rescheduleSelectedDay.slots
                        .filter(s => s.is_available)
                        .map((slot, i) => {
                          const isSelected = rescheduleSelectedSlot?.start_time === slot.start_time
                          return (
                            <Button
                              key={i}
                              variant={isSelected ? 'default' : 'outline'}
                              className="h-11 text-sm w-full"
                              onClick={() => setRescheduleSelectedSlot({ start_time: slot.start_time, end_time: slot.end_time })}
                            >
                              {formatTime12Hour(slot.start_time)}
                            </Button>
                          )
                        })}
                    </div>
                  )
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    Select a date to see available time slots
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={submitReschedule}
                  disabled={rescheduleLoading || !rescheduleSelectedDate || !rescheduleSelectedSlot}
                >
                  {rescheduleLoading ? 'Rescheduling...' : 'Confirm Reschedule'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </TabsContent>
    )
  }

  // History Tab Content Component
  const HistoryTabContent = ({ doctorId }: { doctorId?: string }) => {
    const [history, setHistory] = useState<Session[]>([])
    const [loading, setLoading] = useState(false)
    const [filter, setFilter] = useState<'all' | 'confirmed' | 'cancelled' | 'completed'>('all')
    
    // Fetch history from API
    useEffect(() => {
      if (!doctorId) return
      
      const fetchHistory = async () => {
        setLoading(true)
        try {
          const response = await bookingApi.getSessionHistory(doctorId, filter === 'all' ? undefined : filter)
          if (response.data && response.data.success && response.data.data) {
            const mappedHistory = response.data.data.map((booking: any) => ({
              id: booking.id,
              patientName: booking.patient?.name || 'Unknown Patient',
              patientEmail: booking.patient?.email || '',
              date: booking.date,
              startTime: booking.startTime,
              endTime: booking.endTime,
              status: String(booking.status || '').toLowerCase() as Session['status'],
              createdAt: booking.createdAt,
              branchId: booking.branchId,
              notes: booking.notes,
              branch: booking.branch,
            }))
            setHistory(mappedHistory)
          }
        } catch (error) {
          toast.error('Failed to load session history')
        } finally {
          setLoading(false)
        }
      }
      
      fetchHistory()

      // Refresh every 30 seconds so newly accepted/rejected/rescheduled sessions show up
      const interval = setInterval(fetchHistory, 30000)
      return () => clearInterval(interval)
    }, [doctorId, filter])
    
    const filteredHistory = filter === 'all' 
      ? history 
      : history.filter(s => s.status === filter)
    
    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'confirmed':
          return <Badge className="bg-green-100 text-green-700">Confirmed</Badge>
        case 'cancelled':
          return <Badge variant="destructive">Cancelled</Badge>
        case 'completed':
          return <Badge className="bg-blue-100 text-blue-700">Completed</Badge>
        case 'no_show':
          return <Badge className="bg-yellow-100 text-yellow-700">No Show</Badge>
        default:
          return <Badge variant="secondary">{status}</Badge>
      }
    }
    
    return (
      <TabsContent value="history" className="space-y-6">
        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(['all', 'confirmed', 'cancelled', 'completed'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
        
        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-8 text-muted-foreground">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p>Loading session history...</p>
              </div>
            </CardContent>
          </Card>
        ) : filteredHistory.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No sessions found in history.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((session) => (
              <Card key={session.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-sm font-semibold">
                          {session.patientName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{session.patientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {moment(session.date).format('MMM D, YYYY')} • {formatTime12Hour(session.startTime)}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(session.status)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    )
  }

  // Advanced Settings Component
  const AdvancedSettingsContent = () => (
    <div className="space-y-6">
      {settingsLoading ? (
        <div className="text-center py-4 text-muted-foreground">Loading settings...</div>
      ) : settings ? (
        <div className="space-y-6">
          {/* Auto Accept */}
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label className="text-base font-medium">Auto-accept Bookings</Label>
                {settings.auto_accept_bookings ? (
                  <Badge className="text-xs bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Manual
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Automatically confirm bookings without manual approval
              </p>
            </div>
            <Switch
              checked={settings.auto_accept_bookings}
              onCheckedChange={(checked) => updateSettings({ auto_accept_bookings: checked })}
            />
          </div>
          
          {/* Notice Period */}
          <div className="space-y-3 py-3 border-b border-border">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Notice Period</Label>
              <p className="text-sm text-muted-foreground">
                Minimum time required before a patient can book an appointment
              </p>
            </div>
            <Select
              value={settings.notice_period_hours.toString()}
              onValueChange={(value) => updateSettings({ notice_period_hours: parseInt(value) })}
            >
              <SelectTrigger className="w-full md:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTICE_PERIOD_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Buffer Time */}
          <div className="space-y-3 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Buffer time</Label>
                <p className="text-sm text-muted-foreground">
                  Add time before or after all your sessions to prepare or catch a break
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={settings.buffer_time_minutes.toString()}
                  onValueChange={(value) => updateSettings({ buffer_time_minutes: parseInt(value) })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="No buffer time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No buffer time</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Booking Limits */}
          <div className="space-y-3 py-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Booking Limits</Label>
                <p className="text-sm text-muted-foreground">
                  Maximum number of bookings allowed per day and week
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingLimits(!editingLimits)}
              >
                {editingLimits ? 'Cancel' : 'Edit'}
              </Button>
            </div>
            
            {editingLimits ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Daily Limit</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="No limit"
                    value={settings.daily_booking_limit || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow numbers
                      if (value === '' || /^\d+$/.test(value)) {
                        const numValue = value === '' ? null : parseInt(value);
                        if (numValue === null || (numValue >= 1 && numValue <= 1000)) {
                          setSettings({
                            ...settings,
                            daily_booking_limit: numValue
                          });
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      // Prevent non-numeric keys
                      if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Tab') {
                        e.preventDefault();
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Enter a number between 1-1000 (leave empty for no limit)</p>
                </div>
                <div className="space-y-2">
                  <Label>Weekly Limit</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="No limit"
                    value={settings.weekly_booking_limit || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow numbers
                      if (value === '' || /^\d+$/.test(value)) {
                        const numValue = value === '' ? null : parseInt(value);
                        if (numValue === null || (numValue >= 1 && numValue <= 7000)) {
                          setSettings({
                            ...settings,
                            weekly_booking_limit: numValue
                          });
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      // Prevent non-numeric keys
                      if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Tab') {
                        e.preventDefault();
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Enter a number between 1-7000 (leave empty for no limit)</p>
                </div>
                <div className="col-span-2">
                  <Button onClick={saveBookingLimits} className="w-full md:w-auto">
                    Save Limits
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-md">
                  <span className="text-2xl font-bold text-primary">
                    {settings.daily_booking_limit || '-'}
                  </span>
                  <div className="text-sm">
                    <div className="font-medium">Daily</div>
                    <div className="text-muted-foreground text-xs">
                      {settings.daily_booking_limit ? 'max bookings' : 'No limit'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-md">
                  <span className="text-2xl font-bold text-primary">
                    {settings.weekly_booking_limit || '-'}
                  </span>
                  <div className="text-sm">
                    <div className="font-medium">Weekly</div>
                    <div className="text-muted-foreground text-xs">
                      {settings.weekly_booking_limit ? 'max bookings' : 'No limit'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          Failed to load settings
        </div>
      )}
    </div>
  )
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Availability Settings</h2>
        <p className="text-muted-foreground">
          Manage your appointment availability for each branch.
        </p>
      </div>

      {/* Branch Selection - Always visible */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Select Branch
          </CardTitle>
        </CardHeader>
        <CardContent>
          {branches.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <div className="flex justify-center">
                <Building2 className="h-12 w-12 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No Branches Found</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  You don't have any branches assigned yet. You need to either create your own practice or join a facility first.
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" asChild>
                  <Link to="/settings/branches">
                    Create Private Practice
                  </Link>
                </Button>
                <Button asChild>
                  <Link to="/my-invitations">
                    View Invitations
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-full md:w-[400px]">
                <SelectValue placeholder="Select a branch to manage availability" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>
                    <div className="flex flex-col">
                      <span>{branch.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {branch.city}, {branch.area}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Tabs - Only show when branch is selected */}
      {selectedBranch && (
        <Tabs defaultValue="schedule" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Sessions Tab */}
          <SessionsTabContent doctorId={doctorId} />

          {/* Schedule Tab - New Design */}
          <TabsContent value="schedule" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Availability Hours Section */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Availability hours</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose a schedule below to edit your default hours that you can apply to your sessions types.
                  </p>
                </div>

                <Card>
                  <CardContent className="p-6 space-y-4">
                    {/* Days of week */}
                    <div className="space-y-0">
                      {DAYS_OF_WEEK.map((day) => {
                        const daySchedule = weeklySchedule[day.value]
                        return (
                          <div key={day.value} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
                            {/* Day toggle and label - fixed width column */}
                            <div className="flex items-center gap-3 w-28 pt-1">
                              <Switch
                                checked={daySchedule.enabled}
                                onCheckedChange={() => toggleDay(day.value)}
                              />
                              <span className="text-sm font-semibold whitespace-nowrap">{day.short}DAYS</span>
                            </div>

                            {/* Time slots - takes remaining space */}
                            <div className="flex-1 space-y-2">
                              {daySchedule.enabled && daySchedule.slots.map((slot, slotIndex) => (
                                <div key={slot.id} className="flex items-center gap-2">
                                  <Select 
                                    value={slot.startTime}
                                    onValueChange={(v) => updateTimeSlot(day.value, slot.id, 'startTime', v)}
                                  >
                                    <SelectTrigger className="w-[100px] h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TIME_OPTIONS.map(time => (
                                        <SelectItem key={time.value} value={time.value}>
                                          {time.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <span className="text-sm text-muted-foreground">to</span>
                                  <Select 
                                    value={slot.endTime}
                                    onValueChange={(v) => updateTimeSlot(day.value, slot.id, 'endTime', v)}
                                  >
                                    <SelectTrigger className="w-[100px] h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TIME_OPTIONS.map(time => (
                                        <SelectItem key={time.value} value={time.value}>
                                          {time.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  
                                  {/* Remove button - only show if more than one slot or not the first slot */}
                                  {(daySchedule.slots.length > 1 || slotIndex > 0) && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                      onClick={() => removeTimeSlot(day.value, slot.id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {/* Spacer for alignment when no X button */}
                                  {daySchedule.slots.length === 1 && slotIndex === 0 && (
                                    <div className="h-7 w-7" />
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Add button - fixed width column */}
                            <div className="w-10 flex justify-end pt-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={!daySchedule.enabled}
                                onClick={() => addTimeSlot(day.value)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Block Out Dates Section */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Block out dates</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add days when you do not want to get bookings. This will be applied to all sessions immediately.
                  </p>
                </div>

                <Card>
                  <CardContent className="p-6 space-y-4">
                    {/* Add blockout dates button */}
                    <Dialog open={isBlockOutDialogOpen} onOpenChange={setIsBlockOutDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full justify-start gap-2">
                          <span>Add blockout dates</span>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[400px]">
                        <DialogHeader>
                          <DialogTitle>Select blockout date(s)</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            These date(s) will be blocked out from your schedule
                          </p>
                          
                          {/* Calendar header */}
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {blockOutCalendarMonth.format('MMMM YYYY')}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setBlockOutCalendarMonth(prev => prev.clone().subtract(1, 'month'))}
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setBlockOutCalendarMonth(prev => prev.clone().add(1, 'month'))}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Weekday headers */}
                          <div className="grid grid-cols-7 gap-1 text-center">
                            {weekDays.map(day => (
                              <div key={day} className="text-xs text-muted-foreground py-1">
                                {day}
                              </div>
                            ))}
                          </div>

                          {/* Calendar days */}
                          <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((day, idx) => {
                              const dateStr = day.format('YYYY-MM-DD')
                              const isSelected = selectedBlockOutDates.some(d => moment(d).format('YYYY-MM-DD') === dateStr)
                              const isCurrentMonth = day.month() === blockOutCalendarMonth.month()
                              const isToday = day.isSame(moment(), 'day')
                              const isPast = day.isBefore(moment().startOf('day'))
                              
                              return (
                                <button
                                  key={idx}
                                  disabled={isPast}
                                  className={`
                                    h-9 w-9 rounded-full text-sm flex items-center justify-center
                                    transition-colors
                                    ${!isCurrentMonth ? 'text-muted-foreground/50' : ''}
                                    ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                                    ${isToday && !isSelected ? 'bg-muted font-semibold' : ''}
                                    ${isPast ? 'opacity-40 cursor-not-allowed' : ''}
                                    ${!isSelected && isCurrentMonth && !isPast ? 'hover:bg-muted' : ''}
                                  `}
                                  onClick={() => toggleBlockOutDate(day.toDate())}
                                >
                                  {day.date()}
                                </button>
                              )
                            })}
                          </div>

                          <Button 
                            className="w-full" 
                            onClick={addBlockOutDates}
                            disabled={selectedBlockOutDates.length === 0}
                          >
                            Add date(s)
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* List of block out dates */}
                    {blockOutDates.length > 0 && (
                      <div className="space-y-2">
                        {blockOutDates
                          .sort((a, b) => moment(a.date).diff(moment(b.date)))
                          .map(blockOut => (
                            <div 
                              key={blockOut.id} 
                              className="flex items-center justify-between py-2 px-3 bg-muted rounded-md"
                            >
                              <span className="text-sm">
                                {moment(blockOut.date).format('ddd, MMM D, YYYY')}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => removeBlockOutDate(blockOut.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Save button */}
            <div className="flex justify-end">
              <Button 
                onClick={saveSchedule}
                disabled={loading}
              >
                Save Schedule
              </Button>
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Advanced Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AdvancedSettingsContent />
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <HistoryTabContent doctorId={doctorId} />
        </Tabs>
      )}
    </div>
  )
}
