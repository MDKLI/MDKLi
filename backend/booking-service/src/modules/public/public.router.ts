import { Router } from 'express'
import { prisma } from '../../app'
import { requireAuth, AuthedRequest } from '../../middleware/auth.middleware'
import { generateAvailableSlots, fetchSlotGenerationContext } from '../availability/slot-generator'
import { logger } from '../../utils/logger'
import moment from 'moment-timezone'

const router = Router()

// GET /api/v1/public/doctors - List all active doctors
router.get('/doctors', async (req, res, next) => {
  try {
    const doctors = await prisma.doctor.findMany({
      where: { isActive: true },
      include: {
        branches: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            address: true,
            isVirtual: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })
    
    res.json({
      success: true,
      data: doctors
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/v1/public/doctors/:doctorId - Get doctor profile with branches
router.get('/doctors/:doctorId', async (req, res, next) => {
  try {
    const { doctorId } = req.params
    logger.info(`API: Getting doctor ${doctorId} with branches`)
    
    const doctor = await prisma.doctor.findFirst({
      where: { 
        OR: [
          { id: doctorId },
          { userId: doctorId }
        ],
        isActive: true 
      },
      include: {
        branches: {
          where: { isActive: true },
          orderBy: { name: 'asc' }
        }
      }
    })
    
    if (!doctor) {
      logger.warn(`API: Doctor ${doctorId} not found`)
      res.status(404).json({ error: 'Doctor not found' })
      return
    }
    
    logger.info(`API: Returning doctor ${doctorId} with ${doctor.branches.length} branches:`, doctor.branches.map(b => b.name))
    
    res.json({
      success: true,
      data: doctor
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/v1/public/branches/:branchId/slots - Get available slots for a branch on a date
router.get('/branches/:branchId/slots', async (req, res, next) => {
  try {
    const { branchId } = req.params
    const { date } = req.query
    
    if (!date || typeof date !== 'string') {
      res.status(400).json({ error: 'Date parameter is required (YYYY-MM-DD)' })
      return
    }
    
    // Validate date format
    const dateMoment = moment(date, 'YYYY-MM-DD', true)
    if (!dateMoment.isValid()) {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' })
      return
    }
    
    // Get branch with timezone
    const branch = await prisma.branch.findUnique({
      where: { id: branchId }
    })
    
    if (!branch || !branch.isActive) {
      res.status(404).json({ error: 'Branch not found' })
      return
    }
    
    // Fetch context data
    const context = await fetchSlotGenerationContext(branchId, dateMoment.toDate(), branch.timezone)
    
    // Generate slots
    const slots = generateAvailableSlots(
      {
        branchId,
        date: dateMoment.toDate(),
        timezone: branch.timezone
      },
      context
    )
    
    res.json({
      success: true,
      data: {
        date,
        branchId,
        timezone: branch.timezone,
        slots
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/v1/public/branches/:branchId/availability - Get branch availability rules
router.get('/branches/:branchId/availability', async (req, res, next) => {
  try {
    const { branchId } = req.params
    
    const availability = await prisma.availabilityRule.findMany({
      where: {
        branchId,
        isActive: true
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' }
      ]
    })
    
    // Group by day of week
    const grouped = availability.reduce((acc, rule) => {
      if (!acc[rule.dayOfWeek]) {
        acc[rule.dayOfWeek] = []
      }
      acc[rule.dayOfWeek].push(rule)
      return acc
    }, {} as Record<number, typeof availability>)
    
    res.json({
      success: true,
      data: grouped
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/v1/public/appointments - Book an appointment (patient only)
router.post('/appointments', async (req, res, next) => {
  try {
    const { branchId, date, startTime, endTime, notes, patientId: userId } = req.body
    
    // Validate required fields
    if (!branchId || !date || !startTime || !endTime || !userId) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['branchId', 'date', 'startTime', 'endTime', 'patientId']
      })
      return
    }

    // Resolve the real patient row id from the auth userId
    const patient = await prisma.patient.findUnique({
      where: { userId }
    })

    if (!patient) {
      res.status(404).json({ error: 'Patient profile not found. Please complete your profile before booking.' })
      return
    }

    const patientId = patient.id

    
    // Get branch
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { doctor: true }
    })
    
    if (!branch || !branch.isActive) {
      res.status(404).json({ error: 'Branch not found' })
      return
    }
    
    // Validate slot is still available
    const context = await fetchSlotGenerationContext(branchId, new Date(date), branch.timezone)
    const slots = generateAvailableSlots(
      { branchId, date: new Date(date), timezone: branch.timezone },
      context
    )
    
    const requestedSlot = slots.find(s => s.startTime === startTime && s.endTime === endTime)
    
    if (!requestedSlot || !requestedSlot.available) {
      res.status(409).json({
        error: 'Slot not available',
        message: 'This slot has already been booked or is no longer available'
      })
      return
    }
    
    // Check for double booking (extra safety)
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        branchId,
        date: new Date(date),
        startTime,
        status: {
          not: 'CANCELLED'
        }
      }
    })
    
    if (existingAppointment) {
      res.status(409).json({
        error: 'Slot already booked',
        message: 'This slot has already been booked by another patient'
      })
      return
    }
    
    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        branchId,
        doctorId: branch.doctorId,
        patientId,
        date: new Date(date),
        startTime,
        endTime,
        status: 'PENDING',
        notes: notes || null
      },
      include: {
        branch: true,
        doctor: true,
        patient: true
      }
    })
    
    logger.info(`Appointment created: ${appointment.id} for patient ${patientId}`)
    
    // TODO: Emit appointment.booked event to RabbitMQ
    
    res.status(201).json({
      success: true,
      data: appointment
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/v1/public/appointments/my - Get patient's appointments
router.get('/appointments/my', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.user!.userId

    const patient = await prisma.patient.findUnique({ where: { userId } })
    if (!patient) {
      res.status(404).json({ error: 'Patient profile not found' })
      return
    }
    const patientId = patient.id
    const appointments = await prisma.appointment.findMany({
      where: { patientId },
      include: {
        branch: true,
        doctor: true
      },
      orderBy: [
        { date: 'desc' },
        { startTime: 'asc' }
      ]
    })
    
    res.json({
      success: true,
      data: appointments
    })
  } catch (error) {
    next(error)
  }
})

// PATCH /api/v1/public/appointments/:id/cancel - Cancel appointment (patient)
router.patch('/appointments/:id/cancel', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user!.userId

    const patient = await prisma.patient.findUnique({ where: { userId } })
    if (!patient) {
      res.status(404).json({ error: 'Patient profile not found' })
      return
    }
    const patientId = patient.id
    // Find appointment
    const appointment = await prisma.appointment.findFirst({
      where: {
        id,
        patientId
      }
    })
    
    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found' })
      return
    }
    
    // Check if already cancelled or completed
    if (appointment.status === 'CANCELLED') {
      res.status(400).json({ error: 'Appointment already cancelled' })
      return
    }
    
    if (appointment.status === 'COMPLETED') {
      res.status(400).json({ error: 'Cannot cancel completed appointment' })
      return
    }
    
    // TODO: Check cancellation policy (e.g., 24 hours before)
    
    // Cancel appointment
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledBy: 'PATIENT',
        cancelledAt: new Date()
      }
    })
    
    // TODO: Emit appointment.cancelled event
    
    res.json({
      success: true,
      data: updated
    })
  } catch (error) {
    next(error)
  }
})
// GET /api/v1/public/branches/:branchId/availability-week - Get 7 days of slots
router.get('/branches/:branchId/availability-week', async (req, res, next) => {
  try {
    const { branchId } = req.params

    const branch = await prisma.branch.findUnique({
      where: { id: branchId }
    })

    if (!branch || !branch.isActive) {
      res.status(404).json({ error: 'Branch not found' })
      return
    }

    const days: any[] = []
    for (let i = 0; i < 7; i++) {
      const dateMoment = moment().add(i, 'days')
      const context = await fetchSlotGenerationContext(branchId, dateMoment.toDate(), branch.timezone)
      const rawSlots = generateAvailableSlots(
        { branchId, date: dateMoment.toDate(), timezone: branch.timezone },
        context
      )

      // Normalize slot fields for frontend
      const slots = rawSlots.map((s: any) => ({
        start_time: s.startTime,
        end_time: s.endTime,
        is_available: s.available,
      }))

      days.push({
        date: dateMoment.format('YYYY-MM-DD'),
        dayName: dateMoment.format('ddd').toUpperCase(),
        dayNumber: dateMoment.date(),
        month: dateMoment.format('MMM'),
        slots,
      })
    }

    res.json({
      success: true,
      data: days,
    })
  } catch (error) {
    next(error)
  }
})
export { router as publicRoutes }
