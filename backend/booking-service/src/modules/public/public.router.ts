import { rabbitMQClient } from '../../lib/rabbitmq'
import { Router } from 'express'
import { prisma } from '../../app'
import { requireAuth, AuthedRequest } from '../../middleware/auth.middleware'
import { generateAvailableSlots, fetchSlotGenerationContext } from '../availability/slot-generator'
import { logger } from '../../utils/logger'
import moment from 'moment-timezone'

const router = Router()

// GET /api/v1/public/facilities/:facilityUserId/branches - Public: branches + assigned doctors for a facility
router.get('/facilities/:facilityUserId/branches', async (req, res, next) => {
  try {
    const { facilityUserId } = req.params

    const branches = await prisma.branch.findMany({
      where: { ownerUserId: facilityUserId, isActive: true },
      orderBy: { name: 'asc' }
    })

    const branchesWithDoctors = await Promise.all(
      branches.map(async (branch) => {
        const assignments = await prisma.branchAssignment.findMany({
          where: { branchId: branch.id, isActive: true },
          include: { doctor: true }
        })

        return {
          id: branch.id,
          name: branch.name,
          city: branch.city,
          area: branch.area,
          address: branch.address,
          doctors: assignments
            .filter(a => a.doctor && a.doctor.isActive)
            .map(a => ({
              id: a.doctor.id,
              fullName: a.doctor.name,
              specialty: a.doctor.specialization,
              photoUrl: a.doctor.avatarUrl,
            }))
        }
      })
    )

    res.json({ success: true, data: branchesWithDoctors })
  } catch (error) {
    next(error)
  }
})

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

    // Owned (private-practice) branches come from the relation above.
    // Facility branches this doctor was invited to and accepted come from
    // BranchAssignment instead — Branch.doctorId is never set for those.
    const assignments = await prisma.branchAssignment.findMany({
      where: { doctorId: doctor.id, isActive: true },
      include: { branch: true }
    })

    const assignedBranches = assignments
      .filter(a => a.branch && a.branch.isActive)
      .map(a => ({
        ...a.branch,
        consultationFee: a.consultationFee ?? a.branch.consultationFee,
        isFacilityBranch: true
      }))

    const allBranches = [
      ...doctor.branches.map(b => ({ ...b, isFacilityBranch: false })),
      ...assignedBranches
    ]

    logger.info(`API: Returning doctor ${doctorId} with ${allBranches.length} branches (${doctor.branches.length} owned, ${assignedBranches.length} facility):`, allBranches.map(b => b.name))
    
    res.json({
      success: true,
      data: { ...doctor, branches: allBranches }
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
    const { branchId, date, startTime, endTime, notes, patientId: userId, doctorId: requestedDoctorId } = req.body
    
    // Validate required fields
    if (!branchId || !date || !startTime || !endTime || !userId) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['branchId', 'date', 'startTime', 'endTime', 'patientId']
      })
      return
    }

    // Resolve the real patient row id from the auth userId, creating a local
    // record on first booking if the RabbitMQ sync hasn't caught up yet
    let patient = await prisma.patient.findUnique({
      where: { userId }
    })

    if (!patient) {
      const { patientEmail, patientName } = req.body
      patient = await prisma.patient.create({
        data: {
          userId,
          email: patientEmail || `${userId}@unknown.local`,
          name: patientName || 'Patient'
        }
      })
      logger.info(`Auto-created patient record for userId ${userId} on first booking`)
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

    // Resolve which doctor this booking is for. Legacy private-practice branches
    // have exactly one doctor (branch.doctorId). Facility branches can have several
    // doctors via BranchAssignment, so the caller must specify doctorId explicitly.
    let resolvedDoctorId: string | null = branch.doctorId

    if (requestedDoctorId) {
      const assignment = await prisma.branchAssignment.findFirst({
        where: { branchId, doctorId: requestedDoctorId, isActive: true }
      })
      if (assignment) {
        resolvedDoctorId = requestedDoctorId
      } else if (branch.doctorId !== requestedDoctorId) {
        res.status(400).json({ error: 'This doctor is not assigned to this branch' })
        return
      }
    }

    if (!resolvedDoctorId) {
      res.status(400).json({ error: 'doctorId is required to book this branch' })
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
    
    // Check for double booking (extra safety) - PAYMENT_FAILED slots are free to rebook
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        branchId,
        date: new Date(date),
        startTime,
        status: {
          notIn: ['CANCELLED', 'PAYMENT_FAILED']
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

    // Resolve consultation fee: facility branches can override per-doctor via BranchAssignment
    let consultationFee = branch.consultationFee
    if (requestedDoctorId && requestedDoctorId !== branch.doctorId) {
      const assignment = await prisma.branchAssignment.findFirst({
        where: { branchId, doctorId: requestedDoctorId, isActive: true }
      })
      if (assignment?.consultationFee != null) consultationFee = assignment.consultationFee
    }

    if (!consultationFee || consultationFee <= 0) {
      res.status(400).json({ error: 'This branch has no consultation fee configured' })
      return
    }

    const { paymentMethod, walletPhone, patientPhone } = req.body

    // Create appointment holding the slot while payment is pending
    const appointment = await prisma.appointment.create({
      data: {
        branchId,
        doctorId: resolvedDoctorId,
        patientId,
        date: new Date(date),
        startTime,
        endTime,
        status: 'PENDING_PAYMENT',
        notes: notes || null
      }
    })

    logger.info(`Appointment ${appointment.id} created as PENDING_PAYMENT for patient ${patientId}`)

    const billing = {
      first_name: patient.name?.split(' ')[0] || 'Patient',
      last_name: patient.name?.split(' ').slice(1).join(' ') || 'MDKLI',
      email: patient.email,
      phone_number: patientPhone || walletPhone || '+201000000000',
    }

    // MVP/demo: no real payment gateway. Create a fake transaction and let the
    // frontend show its own fake card-entry page, which calls /payment/fake-confirm.
    const fakePaymobOrderId = `FAKE-${appointment.id}`
    await prisma.paymentTransaction.create({
      data: {
        appointmentId: appointment.id,
        paymobOrderId: fakePaymobOrderId,
        amount: consultationFee,
        method: paymentMethod === 'WALLET' ? 'WALLET' : 'CARD',
        status: 'INITIATED'
      }
    })

    res.status(201).json({
      success: true,
      data: {
        appointmentId: appointment.id,
        status: appointment.status
      }
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
    
    rabbitMQClient
      .publishEvent('appointment.status_changed', {
        id: updated.id,
        doctorId: updated.doctorId,
        branchId: updated.branchId,
        patientId: updated.patientId,
        status: updated.status,
        date: updated.date,
      })
      .catch((err) => logger.error('Failed to publish appointment.status_changed:', err))

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
