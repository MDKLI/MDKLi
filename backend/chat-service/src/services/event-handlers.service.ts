import { prisma } from '../lib/prisma'
import { logger } from '../utils/logger'

/**
 * chat-service keeps a minimal local cache of any user it might need to render
 * in a chat list: id, display name, photo, role, and an "about" line
 * (specialty for doctors, description for facilities, null for patients).
 * This mirrors search-service's sync.service.ts pattern but with a much smaller
 * projection since chat doesn't need branches/fees/etc.
 */

async function upsertUser(params: {
  id: string
  name: string
  photoUrl?: string | null
  role: string
  about?: string | null
}): Promise<void> {
  await prisma.user.upsert({
    where: { id: params.id },
    create: {
      id: params.id,
      name: params.name,
      photoUrl: params.photoUrl ?? null,
      role: params.role,
      about: params.about ?? null,
    },
    update: {
      name: params.name,
      photoUrl: params.photoUrl ?? null,
      role: params.role,
      about: params.about ?? null,
    },
  })
}

export async function handleUserCreated(data: any): Promise<void> {
  // Patient event shape from auth-service: { id, role, email, full_name }
  try {
    await upsertUser({
      id: data.id,
      name: data.full_name || data.email || 'Unknown',
      photoUrl: null,
      role: data.role,
      about: null,
    })
    logger.info(`Synced user.created: ${data.id}`)
  } catch (error) {
    logger.error(`Failed to sync user.created: ${data.id}`, error)
  }
}

export async function handleDoctorEvent(data: any): Promise<void> {
  // Doctor event shape: { id, user_id, full_name, specialty, photo_url, ... }
  try {
    await upsertUser({
      id: data.user_id,
      name: data.full_name,
      photoUrl: data.photo_url,
      role: 'doctor',
      about: data.specialty || null,
    })
    logger.info(`Synced doctor event: ${data.user_id}`)
  } catch (error) {
    logger.error(`Failed to sync doctor event: ${data.user_id}`, error)
  }
}

export async function handleFacilityEvent(data: any): Promise<void> {
  // Facility event shape: { id, user_id, facility_name, description, photo_url, facility_role, ... }
  try {
    await upsertUser({
      id: data.user_id,
      name: data.facility_name,
      photoUrl: data.photo_url,
      role: data.facility_role || 'clinic',
      about: data.description || null,
    })
    logger.info(`Synced facility event: ${data.user_id}`)
  } catch (error) {
    logger.error(`Failed to sync facility event: ${data.user_id}`, error)
  }
}
