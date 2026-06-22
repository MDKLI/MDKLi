import { Router } from 'express'
import { searchAll, searchDoctors, searchFacilities, getSuggestions, getFilters } from '../controllers/search.controller'

const router = Router()

// Main search endpoint
router.get('/search', searchAll)

// Specific searches
router.get('/search/doctors', searchDoctors)
router.get('/search/facilities', searchFacilities)

// Autocomplete suggestions
router.get('/suggestions', getSuggestions)

// Get available filters
router.get('/filters', getFilters)

export default router
