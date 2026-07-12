/**
 * Slot Generation Engine
 * 
 * Pure function that generates available slots for a branch on a given date.
 * This is the core algorithm of the booking system.
 */

import { PrismaClient } from '@prisma/client'
import moment from 'moment-timezone'
import { logger } from '../../utils/logger'

const prisma = new PrismaClient()

export interface TimeSlot {
  startTime: string // "HH:MM" format
  endTime: string   // "HH:MM" format
  available: boolean
}

export interface SlotGenerationInput {
  branchId: string
  date: Date
  timezone: string
}

export interface SlotGenerationContext {
  rules: Array<{
    dayOfWeek: number
    startTime: string
    endTime: string
    slotDurationMinutes: number
  }>
  overrides: Array<{
    date: Date
    type: 'BLOCK' | 'EXTRA'
    startTime: string | null
    endTime: string | null
  }>
  appointments: Array<{
    startTime: string
    endTime: string
    status: string
  }>
}

/**
 * Generate available slots for a branch on a specific date
 * This is a pure function that can be unit tested in isolation
 */
export function generateAvailableSlots(
  input: SlotGenerationInput,
  context: SlotGenerationContext
): TimeSlot[] {
  const { date, timezone } = input
  
  // Convert to moment in branch timezone
  const dateMoment = moment(date).tz(timezone)
  const dayOfWeek = dateMoment.day()
  
  logger.debug(`Generating slots for branch ${input.branchId} on ${dateMoment.format('YYYY-MM-DD')} (day ${dayOfWeek})`)
  
  // Step 1: Find applicable rules for this day of week
  const applicableRules = context.rules.filter(rule => rule.dayOfWeek === dayOfWeek)
  
  if (applicableRules.length === 0) {
    logger.debug(`No rules found for day ${dayOfWeek}`)
    return []
  }
  
  // Step 2: Check for full-day block overrides
  const fullDayBlocks = context.overrides.filter(
    o => o.type === 'BLOCK' && 
         moment(o.date).isSame(dateMoment, 'day') &&
         !o.startTime && !o.endTime
  )
  
  if (fullDayBlocks.length > 0) {
    logger.debug(`Full day blocked for ${dateMoment.format('YYYY-MM-DD')}`)
    return []
  }
  
  // Step 3: Generate base time ranges from rules
  let timeRanges: Array<{ start: string; end: string }> = []
  
  for (const rule of applicableRules) {
    const slots = generateSlotsFromRule(rule)
    timeRanges.push(...slots)
  }
  
  // Step 4: Apply partial block overrides
  const partialBlocks = context.overrides.filter(
    o => o.type === 'BLOCK' && 
         moment(o.date).isSame(dateMoment, 'day') &&
         o.startTime && o.endTime
  )
  
  for (const block of partialBlocks) {
    timeRanges = subtractTimeRange(timeRanges, {
      start: block.startTime!,
      end: block.endTime!
    })
  }
  
  // Step 5: Add extra availability overrides
  const extraSlots = context.overrides.filter(
    o => o.type === 'EXTRA' && 
         moment(o.date).isSame(dateMoment, 'day') &&
         o.startTime && o.endTime
  )
  
  for (const extra of extraSlots) {
    // Find the rule that applies to get slot duration
    const rule = applicableRules[0] // Use first rule's duration
    const extraTimeSlots = generateSlotsFromRule({
      dayOfWeek,
      startTime: extra.startTime!,
      endTime: extra.endTime!,
      slotDurationMinutes: rule.slotDurationMinutes
    })
    timeRanges.push(...extraTimeSlots)
  }
  
  // Step 6: Merge overlapping time ranges
  timeRanges = mergeTimeRanges(timeRanges)
  
  // Step 7: Convert time ranges to slots
  let slots: TimeSlot[] = []
  for (const range of timeRanges) {
    const rule = applicableRules[0]
    const rangeSlots = breakRangeIntoSlots(range, rule.slotDurationMinutes)
    slots.push(...rangeSlots)
  }
  
  // Step 8: Mark booked slots as unavailable
  const bookedSlots = context.appointments
    .filter(a => a.status !== 'CANCELLED')
    .map(a => a.startTime)
  
  slots = slots.map(slot => ({
    ...slot,
    available: !bookedSlots.includes(slot.startTime)
  }))
  
  // Step 9: Filter out slots in the past (if today)
  const now = moment().tz(timezone)
  if (dateMoment.isSame(now, 'day')) {
    slots = slots.filter(slot => {
      const slotTime = moment(`${dateMoment.format('YYYY-MM-DD')} ${slot.startTime}`).tz(timezone)
      return slotTime.isAfter(now)
    })
  }
  
  logger.debug(`Generated ${slots.length} slots for ${dateMoment.format('YYYY-MM-DD')}`)
  
  return slots
}

/**
 * Generate slots from a single availability rule
 */
function generateSlotsFromRule(rule: {
  dayOfWeek: number
  startTime: string
  endTime: string
  slotDurationMinutes: number
}): Array<{ start: string; end: string }> {
  const slots: Array<{ start: string; end: string }> = []
  
  const start = moment(`2000-01-01 ${rule.startTime}`, 'YYYY-MM-DD HH:mm')
  const end = moment(`2000-01-01 ${rule.endTime}`, 'YYYY-MM-DD HH:mm')
  
  let current = start.clone()
  
  while (current.clone().add(rule.slotDurationMinutes, 'minutes').isSameOrBefore(end)) {
    const slotStart = current.format('HH:mm')
    const slotEnd = current.clone().add(rule.slotDurationMinutes, 'minutes').format('HH:mm')
    
    slots.push({
      start: slotStart,
      end: slotEnd
    })
    
    current.add(rule.slotDurationMinutes, 'minutes')
  }
  
  return slots
}

/**
 * Break a time range into slots of given duration
 */
function breakRangeIntoSlots(
  range: { start: string; end: string },
  durationMinutes: number
): TimeSlot[] {
  const slots: TimeSlot[] = []
  
  const start = moment(`2000-01-01 ${range.start}`, 'YYYY-MM-DD HH:mm')
  const end = moment(`2000-01-01 ${range.end}`, 'YYYY-MM-DD HH:mm')
  
  let current = start.clone()
  
  while (current.clone().add(durationMinutes, 'minutes').isSameOrBefore(end)) {
    const slotStart = current.format('HH:mm')
    const slotEnd = current.clone().add(durationMinutes, 'minutes').format('HH:mm')
    
    slots.push({
      startTime: slotStart,
      endTime: slotEnd,
      available: true
    })
    
    current.add(durationMinutes, 'minutes')
  }
  
  return slots
}

/**
 * Subtract a time range from an array of time ranges
 */
function subtractTimeRange(
  ranges: Array<{ start: string; end: string }>,
  toSubtract: { start: string; end: string }
): Array<{ start: string; end: string }> {
  const result: Array<{ start: string; end: string }> = []
  
  const subStart = moment(`2000-01-01 ${toSubtract.start}`, 'YYYY-MM-DD HH:mm')
  const subEnd = moment(`2000-01-01 ${toSubtract.end}`, 'YYYY-MM-DD HH:mm')
  
  for (const range of ranges) {
    const rangeStart = moment(`2000-01-01 ${range.start}`, 'YYYY-MM-DD HH:mm')
    const rangeEnd = moment(`2000-01-01 ${range.end}`, 'YYYY-MM-DD HH:mm')
    
    // If range doesn't overlap with subtraction, keep it
    if (rangeEnd.isSameOrBefore(subStart) || rangeStart.isSameOrAfter(subEnd)) {
      result.push(range)
      continue
    }
    
    // If subtraction covers the entire range, skip it
    if (subStart.isSameOrBefore(rangeStart) && subEnd.isSameOrAfter(rangeEnd)) {
      continue
    }
    
    // If subtraction cuts the beginning
    if (subStart.isAfter(rangeStart) && subEnd.isSameOrAfter(rangeEnd)) {
      result.push({
        start: rangeStart.format('HH:mm'),
        end: subStart.format('HH:mm')
      })
      continue
    }
    
    // If subtraction cuts the end
    if (subStart.isSameOrBefore(rangeStart) && subEnd.isBefore(rangeEnd)) {
      result.push({
        start: subEnd.format('HH:mm'),
        end: rangeEnd.format('HH:mm')
      })
      continue
    }
    
    // If subtraction is in the middle (splits the range)
    if (subStart.isAfter(rangeStart) && subEnd.isBefore(rangeEnd)) {
      result.push({
        start: rangeStart.format('HH:mm'),
        end: subStart.format('HH:mm')
      })
      result.push({
        start: subEnd.format('HH:mm'),
        end: rangeEnd.format('HH:mm')
      })
    }
  }
  
  return result
}

/**
 * Merge overlapping time ranges
 */
function mergeTimeRanges(
  ranges: Array<{ start: string; end: string }>
): Array<{ start: string; end: string }> {
  if (ranges.length === 0) return []
  
  // Sort by start time
  const sorted = [...ranges].sort((a, b) => {
    return moment(`2000-01-01 ${a.start}`, 'YYYY-MM-DD HH:mm')
      .diff(moment(`2000-01-01 ${b.start}`, 'YYYY-MM-DD HH:mm'))
  })
  
  const merged: Array<{ start: string; end: string }> = [sorted[0]]
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const last = merged[merged.length - 1]
    
    const currentStart = moment(`2000-01-01 ${current.start}`, 'YYYY-MM-DD HH:mm')
    const lastEnd = moment(`2000-01-01 ${last.end}`, 'YYYY-MM-DD HH:mm')
    
    // If current overlaps or is adjacent to last, merge them
    if (currentStart.isSameOrBefore(lastEnd)) {
      const currentEnd = moment(`2000-01-01 ${current.end}`, 'YYYY-MM-DD HH:mm')
      if (currentEnd.isAfter(lastEnd)) {
        last.end = current.end
      }
    } else {
      merged.push(current)
    }
  }
  
  return merged
}

/**
 * Fetch context data for slot generation
 */
export async function fetchSlotGenerationContext(
  branchId: string,
  date: Date,
  timezone: string
): Promise<SlotGenerationContext> {
  const dayStart = moment(date).tz(timezone).startOf('day').toDate()
  const dayEnd = moment(date).tz(timezone).endOf('day').toDate()

  const [rules, overrides, appointments] = await Promise.all([
    // Fetch active rules
    prisma.availabilityRule.findMany({
      where: {
        branchId,
        isActive: true
      }
    }),
    
    // Fetch overrides for this date
    prisma.availabilityOverride.findMany({
      where: {
        branchId,
        date: {
          gte: dayStart,
          lt: dayEnd
        }
      }
    }),
    
    // Fetch non-cancelled appointments
    prisma.appointment.findMany({
      where: {
        branchId,
        date: {
          gte: dayStart,
          lt: dayEnd
        },
        status: {
          not: 'CANCELLED'
        }
      },
      select: {
        startTime: true,
        endTime: true,
        status: true
      }
    })
  ])

  return {
    rules: rules.map(r => ({
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
      slotDurationMinutes: r.slotDurationMinutes
    })),
    overrides: overrides.map(o => ({
      date: o.date,
      type: o.type,
      startTime: o.startTime,
      endTime: o.endTime
    })),
    appointments: appointments.map(a => ({
      startTime: a.startTime,
      endTime: a.endTime,
      status: a.status
    }))
  }
}
