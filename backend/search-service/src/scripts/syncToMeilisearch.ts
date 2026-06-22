import { AppDataSource } from '../data-source'
import { SearchableDoctor } from '../entities/SearchableDoctor'
import { SearchableFacility } from '../entities/SearchableFacility'
import { meiliClient, DOCTORS_INDEX, FACILITIES_INDEX } from '../config/meilisearch'
import logger from '../utils/logger'

// Sync doctors from auth database to Meilisearch
export async function syncDoctors() {
  try {
    const doctorRepo = AppDataSource.getRepository(SearchableDoctor)
    const doctors = await doctorRepo.find()

    if (doctors.length === 0) {
      logger.info('No doctors to sync')
      return
    }

    // Transform for Meilisearch
    const meiliDocs = doctors.map(doc => ({
      id: doc.id,
      full_name: doc.full_name,
      title: doc.title,
      specialty: doc.specialty,
      years_of_experience: doc.years_of_experience,
      gender: doc.gender,
      description: doc.description,
      photo_url: doc.photo_url,
      phone_number: doc.phone_number,
      city: doc.city,
      has_private_practice: doc.has_private_practice,
      verification_status: doc.verification_status,
      created_at: doc.created_at,
    }))

    const index = meiliClient.index(DOCTORS_INDEX)
    await index.addDocuments(meiliDocs)

    logger.info(`✅ Synced ${doctors.length} doctors to Meilisearch`)
  } catch (error) {
    logger.error('Failed to sync doctors:', error)
    throw error
  }
}

// Sync facilities from auth database to Meilisearch
export async function syncFacilities() {
  try {
    const facilityRepo = AppDataSource.getRepository(SearchableFacility)
    const facilities = await facilityRepo.find()

    if (facilities.length === 0) {
      logger.info('No facilities to sync')
      return
    }

    // Transform for Meilisearch
    const meiliDocs = facilities.map(fac => ({
      id: fac.id,
      facility_name: fac.facility_name,
      facility_type: fac.facility_type,
      description: fac.description,
      photo_url: fac.photo_url,
      address: fac.address,
      city: fac.city,
      status: fac.status,
      facility_role: fac.facility_role,
      created_at: fac.created_at,
    }))

    const index = meiliClient.index(FACILITIES_INDEX)
    await index.addDocuments(meiliDocs)

    logger.info(`✅ Synced ${facilities.length} facilities to Meilisearch`)
  } catch (error) {
    logger.error('Failed to sync facilities:', error)
    throw error
  }
}

// Full sync
export async function fullSync() {
  logger.info('🚀 Starting full data sync to Meilisearch...')
  await syncDoctors()
  await syncFacilities()
  logger.info('✅ Full sync completed')
}

// Run if called directly
if (require.main === module) {
  AppDataSource.initialize()
    .then(() => {
      logger.info('Database connected')
      return fullSync()
    })
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Sync failed:', error)
      process.exit(1)
    })
}
