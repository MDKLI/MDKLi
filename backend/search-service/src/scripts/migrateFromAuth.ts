import { AppDataSource } from '../data-source'
import { SearchableDoctor } from '../entities/SearchableDoctor'
import { SearchableFacility } from '../entities/SearchableFacility'
import logger from '../utils/logger'

// Get auth database connection string from env or use default
const AUTH_DB_CONFIG = {
  host: process.env.AUTH_DB_HOST || 'postgres',
  port: parseInt(process.env.AUTH_DB_PORT || '5432'),
  database: process.env.AUTH_DB_NAME || 'authdb',
  user: process.env.AUTH_DB_USER || 'postgres',
  password: process.env.AUTH_DB_PASSWORD || 'postgres',
}

export async function migrateDoctorsFromAuth() {
  try {
    const { Client } = await import('pg')
    const client = new Client(AUTH_DB_CONFIG)
    await client.connect()

    // Fetch doctors from auth database with their user and clinic info
    const result = await client.query(`
      SELECT 
        d.id,
        d.user_id,
        d.full_name,
        d.title,
        d.specialty,
        d.years_of_experience,
        d.gender,
        d.description,
        d.phone_number,
        d.has_private_practice,
        d.is_active,
        d.photo_url,
        cp.clinic_name,
        cp.facility_type as clinic_type,
        cp.city,
        cp.address as clinic_address
      FROM doctors d
      LEFT JOIN clinic_profiles cp ON d.clinic_id = cp.id
    `)

    // Fetch doctor's own branches (private practice)
    const ownBranchesResult = await client.query(`
      SELECT 
        d.id as doctor_id,
        b.name,
        b.city,
        b.area,
        b.address,
        b.phone_numbers,
        b.consultation_fee,
        'private_practice' as branch_type
      FROM doctors d
      JOIN branches b ON b.user_id = d.user_id
      WHERE d.is_active = true
    `)

    // Fetch branches from invitations (hospital/center)
    const invitedBranchesResult = await client.query(`
      SELECT 
        db.doctor_id,
        b.name,
        b.city,
        b.area,
        b.address,
        b.phone_numbers,
        db."consultationFee" as consultation_fee,
        'hospital' as branch_type
      FROM doctor_branches db
      JOIN branches b ON db.branch_id = b.id
      WHERE db.doctor_id IN (
        SELECT doctor_id FROM doctor_branch_invitations WHERE status = 'accepted'
      )
    `)

    // Group branches by doctor_id
    const branchesByDoctor: { [key: string]: any[] } = {}
    
    // Add own branches
    for (const branch of ownBranchesResult.rows) {
      if (!branchesByDoctor[branch.doctor_id]) {
        branchesByDoctor[branch.doctor_id] = []
      }
      branchesByDoctor[branch.doctor_id].push({
        name: branch.name,
        city: branch.city,
        area: branch.area,
        address: branch.address,
        phone_numbers: branch.phone_numbers,
        consultation_fee: branch.consultation_fee,
        branch_type: branch.branch_type
      })
    }

    // Add invited branches
    for (const branch of invitedBranchesResult.rows) {
      if (!branchesByDoctor[branch.doctor_id]) {
        branchesByDoctor[branch.doctor_id] = []
      }
      // Avoid duplicates by checking if branch already exists
      const exists = branchesByDoctor[branch.doctor_id].some(
        (b: any) => b.name === branch.name && b.city === branch.city && b.area === branch.area
      )
      if (!exists) {
        branchesByDoctor[branch.doctor_id].push({
          name: branch.name,
          city: branch.city,
          area: branch.area,
          address: branch.address,
          phone_numbers: branch.phone_numbers,
          consultation_fee: branch.consultation_fee,
          branch_type: branch.branch_type || 'clinic'
        })
      }
    }

    logger.info(`Fetched ${result.rows.length} doctors from auth database`)

    const doctorRepo = AppDataSource.getRepository(SearchableDoctor)

    for (const row of result.rows) {
      const doctor = doctorRepo.create({
        id: row.id,
        user_id: row.user_id,
        full_name: row.full_name || 'Unknown',
        title: row.title,
        specialty: row.specialty,
        years_of_experience: row.years_of_experience?.toString() || null,
        gender: row.gender,
        description: row.description,
        photo_url: row.photo_url,
        phone_number: row.phone_number,
        city: row.city,
        area: null, // clinic_profiles doesn't have area column
        has_private_practice: row.has_private_practice || false,
        clinic_name: row.clinic_name,
        clinic_type: row.clinic_type,
        branches: branchesByDoctor[row.id] || [],
        verification_status: 'pending',
      })

      await doctorRepo.save(doctor)
    }

    await client.end()
    logger.info(`✅ Migrated ${result.rows.length} doctors to searchable_doctors`)
  } catch (error) {
    logger.error('Failed to migrate doctors:', error)
    throw error
  }
}

export async function migrateFacilitiesFromAuth() {
  try {
    const { Client } = await import('pg')
    const client = new Client(AUTH_DB_CONFIG)
    await client.connect()

    // Fetch all facilities from clinic_profiles (includes hospitals, centers, and pharmacies)
    const result = await client.query(`
      SELECT 
        id,
        user_id,
        clinic_name,
        facility_type,
        description,
        city,
        address,
        phone_numbers,
        photo_url,
        status
      FROM clinic_profiles
    `)

    // Fetch all branches for facilities
    const branchesResult = await client.query(`
      SELECT 
        b.user_id,
        b.name,
        b.city,
        b.area,
        b.address,
        b.phone_numbers,
        'branch' as branch_type
      FROM branches b
      JOIN clinic_profiles cp ON b.user_id = cp.user_id
      WHERE cp.status IN ('verified', 'pending')
    `)

    // Group branches by user_id
    const branchesByUser: { [key: string]: any[] } = {}
    for (const branch of branchesResult.rows) {
      if (!branchesByUser[branch.user_id]) {
        branchesByUser[branch.user_id] = []
      }
      branchesByUser[branch.user_id].push({
        name: branch.name,
        city: branch.city,
        area: branch.area,
        address: branch.address,
        phone_numbers: branch.phone_numbers,
        branch_type: branch.branch_type
      })
    }

    logger.info(`Fetched ${result.rows.length} facilities and ${branchesResult.rows.length} branches from auth database`)

    const facilityRepo = AppDataSource.getRepository(SearchableFacility)

    for (const row of result.rows) {
      // Determine facility_role based on facility_type
      // pharmacy -> 'pharmacy', hospital/center -> 'clinic'
      const facilityRole = row.facility_type === 'pharmacy' ? 'pharmacy' : 'clinic'
      
      // Get branches for this facility
      const facilityBranches = branchesByUser[row.user_id] || []
      
      // Use first branch's location data if facility has no location data
      const firstBranch = facilityBranches[0]
      
      const facility = facilityRepo.create({
        id: row.id,
        user_id: row.user_id,
        facility_name: row.clinic_name || 'Unknown Facility',
        facility_type: row.facility_type,
        description: row.description,
        photo_url: row.photo_url,
        phone_numbers: row.phone_numbers || [],
        address: row.address || firstBranch?.address || null,
        city: row.city || firstBranch?.city || null,
        area: firstBranch?.area || null,
        status: 'pending',
        facility_role: facilityRole,
        branches: facilityBranches,
      })

      await facilityRepo.save(facility)
    }

    await client.end()
    logger.info(`✅ Migrated ${result.rows.length} facilities to searchable_facilities`)
  } catch (error) {
    logger.error('Failed to migrate facilities:', error)
    throw error
  }
}

export async function fullMigrate() {
  logger.info('🚀 Starting migration from auth database...')
  await migrateDoctorsFromAuth()
  await migrateFacilitiesFromAuth()
  logger.info('✅ Full migration completed')
}

// Run if called directly
if (require.main === module) {
  AppDataSource.initialize()
    .then(() => {
      logger.info('Search database connected')
      return fullMigrate()
    })
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Migration failed:', error)
      process.exit(1)
    })
}
