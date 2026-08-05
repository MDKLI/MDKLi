import { Router } from "express";
import {
	getFilters,
	getSuggestions,
	searchAll,
	searchDoctors,
	searchFacilities,
} from "../controllers/search.controller";

const router = Router();

// Main search endpoint
router.post("/search", searchAll);
router.get("/search", searchAll);

// Specific searches
router.post("/search/doctors", searchDoctors);
router.get("/search/doctors", searchDoctors);
router.post("/search/facilities", searchFacilities);
router.get("/search/facilities", searchFacilities);


// Autocomplete suggestions
router.get("/suggestions", getSuggestions);

// Get available filters
router.get("/filters", getFilters);

export default router;
