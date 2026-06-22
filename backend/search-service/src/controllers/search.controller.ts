import { Request, Response } from 'express'
import { AppDataSource } from '../data-source'
import { SearchableDoctor } from '../entities/SearchableDoctor'
import { SearchableFacility } from '../entities/SearchableFacility'
import { meiliClient, DOCTORS_INDEX, FACILITIES_INDEX } from '../config/meilisearch'
import logger from '../utils/logger'

const doctorRepo = () => AppDataSource.getRepository(SearchableDoctor)
const facilityRepo = () => AppDataSource.getRepository(SearchableFacility)

// Search both doctors and facilities
export const searchAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q: query, type, ...filters } = req.query

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query parameter "q" is required' })
      return
    }

    const results: any = {}

    // Search doctors
    if (!type || type === 'doctor') {
      const doctorsIndex = meiliClient.index(DOCTORS_INDEX)
      const doctorsSearch = await doctorsIndex.search(query, {
        limit: 20,
        filter: buildDoctorFilters(filters),
      })
      results.doctors = doctorsSearch.hits
    }

    // Search facilities
    if (!type || type === 'facility') {
      const facilitiesIndex = meiliClient.index(FACILITIES_INDEX)
      const facilitiesSearch = await facilitiesIndex.search(query, {
        limit: 20,
        filter: buildFacilityFilters(filters),
      })
      results.facilities = facilitiesSearch.hits
    }

    res.json({
      success: true,
      data: results,
      total: (results.doctors?.length || 0) + (results.facilities?.length || 0),
    })
  } catch (error) {
    logger.error('Search error:', error)
    res.status(500).json({ error: 'Search failed' })
  }
}

// Search only doctors with proper branch filtering
export const searchDoctors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      q: query, 
      city, 
      area, 
      location_type, // 'hospital' | 'clinic' | 'all'
      gender,
      specialty,
      title,
      ...otherFilters 
    } = req.query

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query parameter "q" is required' })
      return
    }

    // Get all doctors from database (we need branches data which is in JSON)
    const qb = doctorRepo().createQueryBuilder('doctor')
    
    // Search by name, specialty, or description
    if (query && query !== '*') {
      qb.where('doctor.full_name ILIKE :query', { query: `%${query}%` })
        .orWhere('doctor.specialty ILIKE :query', { query: `%${query}%` })
        .orWhere('doctor.description ILIKE :query', { query: `%${query}%` })
    }

    // Add direct doctor filters
    if (gender && typeof gender === 'string') {
      qb.andWhere('doctor.gender = :gender', { gender })
    }
    if (specialty && typeof specialty === 'string') {
      qb.andWhere('doctor.specialty = :specialty', { specialty })
    }
    if (title && typeof title === 'string') {
      qb.andWhere('doctor.title = :title', { title })
    }

    // Get all matching doctors - return ALL doctors (individuals), not facilities
    const doctors = await qb.getMany()

    // Filter doctors based on location type and branches
    let filteredDoctors = doctors

    // Filter by location type (hospital vs clinic)
    if (location_type && location_type !== 'all') {
      filteredDoctors = filteredDoctors.filter(doctor => {
        const branches = doctor.branches || []
        
        if (location_type === 'hospital') {
          // Show doctors who have at least one branch at a hospital
          return branches.some((branch: any) => branch.branch_type === 'hospital')
        } else if (location_type === 'clinic') {
          // Show doctors with private practice OR branches at clinics/centers
          if (doctor.has_private_practice) return true
          return branches.some((branch: any) => 
            branch.branch_type === 'clinic' || branch.branch_type === 'center'
          )
        }
        return true
      })
    }

    // Filter by city and/or area (check if ANY branch matches)
    if ((city && typeof city === 'string') || (area && typeof area === 'string')) {
      filteredDoctors = filteredDoctors.filter(doctor => {
        const branches = doctor.branches || []
        if (branches.length === 0) return false
        
        return branches.some((branch: any) => {
          const cityMatch = !city || branch.city === city
          const areaMatch = !area || branch.area === area
          return cityMatch && areaMatch
        })
      })
    }

    res.json({
      success: true,
      data: filteredDoctors.slice(0, 50),
      total: filteredDoctors.length,
    })
  } catch (error) {
    logger.error('Doctors search error:', error)
    res.status(500).json({ error: 'Search failed' })
  }
}

// Search only facilities with branch-based filtering
export const searchFacilities = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      q: query, 
      city, 
      area,
      ...otherFilters 
    } = req.query

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query parameter "q" is required' })
      return
    }

    // Get all facilities from database (we need branches data which is in JSON)
    const qb = facilityRepo().createQueryBuilder('facility')
    
    // Add facility_role filter first (pharmacy or clinic) - this is mandatory
    if (otherFilters.facility_role && typeof otherFilters.facility_role === 'string') {
      qb.where('facility.facility_role = :facility_role', { facility_role: otherFilters.facility_role })
    }

    // Search by name or description (must be AND with the role filter)
    if (query && query !== '*') {
      qb.andWhere(
        '(facility.facility_name ILIKE :query OR facility.description ILIKE :query)',
        { query: `%${query}%` }
      )
    }

    // Add facility_type filter
    if (otherFilters.facility_type && typeof otherFilters.facility_type === 'string') {
      qb.andWhere('facility.facility_type = :facility_type', { facility_type: otherFilters.facility_type })
    }

    // Get all matching facilities
    const facilities = await qb.getMany()

    // Process facilities to filter by branch city/area and add matching branch info
    const processedFacilities = facilities.map(facility => {
      const branches = facility.branches || []
      
      // Find matching branch (if city/area filters applied)
      let matchingBranch = null
      
      if ((city && typeof city === 'string') || (area && typeof area === 'string')) {
        matchingBranch = branches.find((branch: any) => {
          const cityMatch = !city || branch.city === city
          const areaMatch = !area || branch.area === area
          return cityMatch && areaMatch
        })
        
        // If no matching branch and filters are applied, exclude this facility
        if (!matchingBranch) {
          return null
        }
      }
      
      // If no filter or no match, use first branch
      const displayBranch = matchingBranch || branches[0] || null
      
      return {
        ...facility,
        // Override address/city/area with branch info if available
        address: displayBranch?.address || facility.address,
        city: displayBranch?.city || facility.city,
        area: displayBranch?.area || facility.area,
        // Keep full branches array for reference
        branches: branches
      }
    }).filter(f => f !== null) // Remove nulls (facilities that didn't match branch filters)

    res.json({
      success: true,
      data: processedFacilities.slice(0, 50),
      total: processedFacilities.length,
    })
  } catch (error) {
    logger.error('Facilities search error:', error)
    res.status(500).json({ error: 'Search failed' })
  }
}

// Get search suggestions (autocomplete)
export const getSuggestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q: query, type } = req.query

    if (!query || typeof query !== 'string' || query.length < 2) {
      res.json({ success: true, data: [] })
      return
    }

    const suggestions: string[] = []

    // Get doctor suggestions
    if (!type || type === 'doctor') {
      const doctorsIndex = meiliClient.index(DOCTORS_INDEX)
      const doctorsResult = await doctorsIndex.search(query, { limit: 5 })
      suggestions.push(
        ...doctorsResult.hits.map((h: any) => h.full_name),
        ...doctorsResult.hits.map((h: any) => h.specialty).filter(Boolean)
      )
    }

    // Get facility suggestions
    if (!type || type === 'facility') {
      const facilitiesIndex = meiliClient.index(FACILITIES_INDEX)
      const facilitiesResult = await facilitiesIndex.search(query, { limit: 5 })
      suggestions.push(
        ...facilitiesResult.hits.map((h: any) => h.facility_name)
      )
    }

    // Remove duplicates and limit
    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 10)

    res.json({
      success: true,
      data: uniqueSuggestions,
    })
  } catch (error) {
    logger.error('Suggestions error:', error)
    res.status(500).json({ error: 'Failed to get suggestions' })
  }
}

// All filter values from signup data
const ALL_SPECIALTIES = [
  'cardiology', 'dermatology', 'endocrinology', 'ent', 'gastroenterology',
  'general_medicine', 'general_surgery', 'gynecology', 'hematology', 'nephrology',
  'neurology', 'neurosurgery', 'oncology', 'ophthalmology', 'orthopedics',
  'pediatrics', 'plastic_surgery', 'psychiatry', 'pulmonology', 'radiology',
  'rheumatology', 'urology', 'vascular_surgery', 'dentistry', 'dental_surgery',
  'orthodontics', 'anesthesiology', 'emergency_medicine', 'family_medicine',
  'internal_medicine', 'physical_therapy', 'nutrition'
];

const ALL_TITLES = [
  'professor', 'lecturer', 'consultant', 'specialist'
];

const ALL_GENDERS = [
  'male', 'female'
];

const ALL_CITIES = [
  { id: 'cairo', name: 'Cairo', areas: ['Nasr City', 'Heliopolis', 'New Cairo', 'Maadi', 'Mokattam', 'Shorouk', 'Badr City', 'El Rehab', 'Madinaty', 'Zamalek', 'Downtown', 'Garden City', 'Ain Shams', 'El Marg', 'El Salam', 'El Nozha', 'Abbassia', 'Ramses', 'Helwan', 'Dar El Salam', 'Basatin', 'Shubra'] },
  { id: 'giza', name: 'Giza', areas: ['Dokki', 'Mohandessin', 'Haram', 'Faisal', 'Sheikh Zayed', '6th of October', 'Agouza', 'Imbaba', 'Bulaq El Dakrour', 'Giza Square', 'Hadayek Al Ahram', 'Kerdasa', 'Oseem'] },
  { id: 'alexandria', name: 'Alexandria', areas: ['Smouha', 'Sidi Gaber', 'Sporting', 'Stanley', 'Miami', 'Mandara', 'Agami', 'Borg El Arab', 'Gleem', 'Louran', 'Raml Station'] },
  { id: 'qalyubia', name: 'Qalyubia', areas: ['Shubra El Kheima', 'Banha', 'Qalyub', 'Obour', 'Khanka', 'Toukh', 'Kafr Shukr'] },
  { id: 'sharqia', name: 'Sharqia', areas: ['Zagazig', '10th of Ramadan', 'Belbeis', 'Minya El Qamh', 'Abu Hammad'] },
  { id: 'dakahlia', name: 'Dakahlia', areas: ['Mansoura', 'Mit Ghamr', 'Talkha', 'Aga', 'Belqas'] },
  { id: 'gharbia', name: 'Gharbia', areas: ['Tanta', 'El Mahalla El Kubra', 'Kafr El Zayat', 'Zefta'] },
  { id: 'beheira', name: 'Beheira', areas: ['Damanhour', 'Kafr El Dawwar', 'Rashid', 'Edku'] },
  { id: 'kafr-el-sheikh', name: 'Kafr El Sheikh', areas: ['Kafr El Sheikh', 'Desouk', 'Baltim'] },
  { id: 'monufia', name: 'Monufia', areas: ['Shebin El Kom', 'Menouf', 'Ashmoun', 'Sadat City'] },
  { id: 'ismailia', name: 'Ismailia', areas: ['Ismailia City', 'Fayed', 'Abu Suwir'] },
  { id: 'port-said', name: 'Port Said', areas: ['Port Said', 'Port Fouad'] },
  { id: 'suez', name: 'Suez', areas: ['Suez', 'Ataqa'] },
  { id: 'fayoum', name: 'Fayoum', areas: ['Fayoum City', 'Senuris', 'Etsa'] },
  { id: 'beni-suef', name: 'Beni Suef', areas: ['Beni Suef City', 'El Wasta', 'Nasser'] },
  { id: 'minya', name: 'Minya', areas: ['Minya City', 'Mallawi', 'Samalut'] },
  { id: 'assiut', name: 'Assiut', areas: ['Assiut City', 'Dairut', 'Abnoub'] },
  { id: 'sohag', name: 'Sohag', areas: ['Sohag City', 'Akhmim', 'Tahta'] },
  { id: 'qena', name: 'Qena', areas: ['Qena City', 'Nag Hammadi', 'Qus'] },
  { id: 'luxor', name: 'Luxor', areas: ['Luxor City', 'Armant', 'Esna'] },
  { id: 'aswan', name: 'Aswan', areas: ['Aswan City', 'Kom Ombo', 'Edfu'] },
  { id: 'red-sea', name: 'Red Sea', areas: ['Hurghada', 'El Gouna', 'Safaga', 'Marsa Alam'] },
  { id: 'south-sinai', name: 'South Sinai', areas: ['Sharm El Sheikh', 'Dahab', 'Nuweiba', 'El Tor'] },
  { id: 'north-sinai', name: 'North Sinai', areas: ['Arish', 'Sheikh Zuweid', 'Rafah'] },
  { id: 'matrouh', name: 'Matrouh', areas: ['Marsa Matrouh', 'El Alamein', 'Siwa'] },
];

// Get available filters
export const getFilters = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get distinct values from database for additional filters
    const doctors = await doctorRepo().find({ select: ['specialty', 'title', 'branches'] })
    const facilities = await facilityRepo().find({ select: ['facility_type', 'city', 'area'] })

    // Get unique cities and areas from ALL_CITIES
    const allCityNames = ALL_CITIES.map(c => c.id);
    const allAreas = ALL_CITIES.flatMap(c => c.areas);

    const filters = {
      doctors: {
        specialties: ALL_SPECIALTIES,
        titles: ALL_TITLES,
        genders: ALL_GENDERS,
        cities: allCityNames,
        areas: allAreas,
      },
      facilities: {
        types: [...new Set(facilities.map(f => f.facility_type).filter(Boolean))].sort(),
        cities: [...new Set(facilities.map(f => f.city).filter(Boolean))].sort(),
        areas: [...new Set(facilities.map(f => f.area).filter(Boolean))].sort(),
      },
      cities_with_areas: ALL_CITIES,
    }

    res.json({ success: true, data: filters })
  } catch (error) {
    logger.error('Get filters error:', error)
    res.status(500).json({ error: 'Failed to get filters' })
  }
}

// Helper functions
function buildDoctorFilters(filters: any): string | undefined {
  const conditions: string[] = []

  if (filters.gender) conditions.push(`gender = "${filters.gender}"`)
  if (filters.specialty) conditions.push(`specialty = "${filters.specialty}"`)
  if (filters.title) conditions.push(`title = "${filters.title}"`)
  if (filters.city) conditions.push(`city = "${filters.city}"`)
  if (filters.area) conditions.push(`area = "${filters.area}"`)
  
  // Handle has_clinic filter for Hospital/Clinic selection
  // When has_clinic is true, show doctors who work at hospitals/clinics (have clinic_name)
  if (filters.has_clinic === true || filters.has_clinic === 'true') {
    conditions.push(`clinic_name EXISTS`)
  }
  
  if (filters.verification_status) {
    conditions.push(`verification_status = "${filters.verification_status}"`)
  }

  return conditions.length > 0 ? conditions.join(' AND ') : undefined
}

function buildFacilityFilters(filters: any): string | undefined {
  const conditions: string[] = []

  if (filters.facility_type) conditions.push(`facility_type = "${filters.facility_type}"`)
  if (filters.facility_role) conditions.push(`facility_role = "${filters.facility_role}"`)
  if (filters.status) conditions.push(`status = "${filters.status}"`)
  if (filters.city) conditions.push(`city = "${filters.city}"`)
  if (filters.area) conditions.push(`area = "${filters.area}"`)

  return conditions.length > 0 ? conditions.join(' AND ') : undefined
}
