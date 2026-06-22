import { Request, Response } from 'express'
import { AppDataSource } from '../data-source'
import { SearchableDoctor } from '../entities/SearchableDoctor'
import { SearchableFacility } from '../entities/SearchableFacility'
import { meiliClient, DOCTORS_INDEX, FACILITIES_INDEX } from '../config/meilisearch'
import logger from '../utils/logger'

// Sync data from auth service webhook
export const syncFromAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, data } = req.body

    if (type === 'doctor') {
      await syncDoctor(data)
    } else if (type === 'facility') {
      await syncFacility(data)
    } else if (type === 'full_sync') {
      await syncAll()
    }

    res.json({ success: true, message: 'Sync completed' })
  } catch (error) {
    logger.error('Sync error:', error)
    res.status(500).json({ error: 'Sync failed' })
  }
}

// Sync single doctor
async function syncDoctor(data: any) {
  const index = meiliClient.index(DOCTORS_INDEX)
  
  // Save to database
  const doctorRepo = AppDataSource.getRepository(SearchableDoctor)
  const doctor = doctorRepo.create({
    id: data.id,
    user_id: data.user_id,
    full_name: data.full_name,
    title: data.title,
    specialty: data.specialty,
    years_of_experience: data.years_of_experience,
    gender: data.gender,
    description: data.description,
    photo_url: data.photo_url,
    phone_number: data.phone_number,
    city: data.city,
    has_private_practice: data.has_private_practice,
    verification_status: data.verification_status || 'pending',
  })
  await doctorRepo.save(doctor)

  // Index in Meilisearch
  await index.addDocuments([{
    id: doctor.id,
    full_name: doctor.full_name,
    title: doctor.title,
    specialty: doctor.specialty,
    years_of_experience: doctor.years_of_experience,
    gender: doctor.gender,
    description: doctor.description,
    photo_url: doctor.photo_url,
    phone_number: doctor.phone_number,
    city: doctor.city,
    has_private_practice: doctor.has_private_practice,
    verification_status: doctor.verification_status,
    created_at: doctor.created_at,
  }])

  logger.info(`Synced doctor: ${doctor.full_name}`)
}

// Sync single facility
async function syncFacility(data: any) {
  const index = meiliClient.index(FACILITIES_INDEX)
  
  // Save to database
  const facilityRepo = AppDataSource.getRepository(SearchableFacility)
  const facility = facilityRepo.create({
    id: data.id,
    user_id: data.user_id,
    facility_name: data.facility_name,
    facility_type: data.facility_type,
    description: data.description,
    photo_url: data.photo_url,
    phone_numbers: data.phone_numbers,
    address: data.address,
    city: data.city,
    branches: data.branches,
    status: data.status || 'pending',
    facility_role: data.facility_role,
  })
  await facilityRepo.save(facility)

  // Index in Meilisearch
  await index.addDocuments([{
    id: facility.id,
    facility_name: facility.facility_name,
    facility_type: facility.facility_type,
    description: facility.description,
    photo_url: facility.photo_url,
    address: facility.address,
    city: facility.city,
    status: facility.status,
    facility_role: facility.facility_role,
    created_at: facility.created_at,
  }])

  logger.info(`Synced facility: ${facility.facility_name}`)
}

// Sync all data
async function syncAll() {
  // This would fetch from auth service and sync everything
  logger.info('Full sync requested')
}

// Manual sync endpoint
export const triggerSync = async (req: Request, res: Response): Promise<void> => {
  try {
    // Import and run sync script
    const { fullSync } = await import('../scripts/syncToMeilisearch')
    await fullSync()
    res.json({ success: true, message: 'Sync completed' })
  } catch (error) {
    logger.error('Manual sync error:', error)
    res.status(500).json({ error: 'Sync failed' })
  }
}

// Migrate from auth database endpoint
export const triggerMigrate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullMigrate } = await import('../scripts/migrateFromAuth')
    await fullMigrate()
    res.json({ success: true, message: 'Migration completed' })
  } catch (error) {
    logger.error('Migration error:', error)
    res.status(500).json({ error: 'Migration failed' })
  }
}
