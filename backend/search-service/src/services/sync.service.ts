import {
	DOCTORS_INDEX,
	FACILITIES_INDEX,
	meiliClient,
} from "../config/meilisearch";
import type { SearchableDoctor } from "../entities/SearchableDoctor";
import type { SearchableFacility } from "../entities/SearchableFacility";
import logger from "../utils/logger";

// Sync a single doctor to Meilisearch
export async function syncDoctorToMeilisearch(
	doctor: SearchableDoctor,
): Promise<void> {
	try {
		const index = meiliClient.index(DOCTORS_INDEX);

		const meiliDoc = {
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
			area: doctor.area,
			has_private_practice: doctor.has_private_practice,
			has_clinic: !!doctor.clinic_name,
			clinic_name: doctor.clinic_name,
			clinic_type: doctor.clinic_type,
			verification_status: doctor.verification_status,
			created_at: doctor.created_at,
			is_blocked: doctor.is_blocked,
		};

		await index.addDocuments([meiliDoc]);
		logger.debug(`Synced doctor ${doctor.id} to Meilisearch`);
	} catch (error) {
		logger.error(`Failed to sync doctor ${doctor.id} to Meilisearch:`, error);
		throw error;
	}
}

// Delete doctor from Meilisearch
export async function deleteDoctorFromMeilisearch(
	doctorId: string,
): Promise<void> {
	try {
		const index = meiliClient.index(DOCTORS_INDEX);
		await index.deleteDocument(doctorId);
		logger.debug(`Deleted doctor ${doctorId} from Meilisearch`);
	} catch (error) {
		logger.error(
			`Failed to delete doctor ${doctorId} from Meilisearch:`,
			error,
		);
		throw error;
	}
}

// Sync a single facility to Meilisearch
export async function syncFacilityToMeilisearch(
	facility: SearchableFacility,
): Promise<void> {
	try {
		const index = meiliClient.index(FACILITIES_INDEX);

		const meiliDoc = {
			id: facility.id,
			facility_name: facility.facility_name,
			facility_type: facility.facility_type,
			description: facility.description,
			photo_url: facility.photo_url,
			address: facility.address,
			city: facility.city,
			area: facility.area,
			status: facility.status,
			facility_role: facility.facility_role,
			created_at: facility.created_at,
			is_blocked: facility.is_blocked,
		};

		await index.addDocuments([meiliDoc]);
		logger.debug(`Synced facility ${facility.id} to Meilisearch`);
	} catch (error) {
		logger.error(
			`Failed to sync facility ${facility.id} to Meilisearch:`,
			error,
		);
		throw error;
	}
}

// Delete facility from Meilisearch
export async function deleteFacilityFromMeilisearch(
	facilityId: string,
): Promise<void> {
	try {
		const index = meiliClient.index(FACILITIES_INDEX);
		await index.deleteDocument(facilityId);
		logger.debug(`Deleted facility ${facilityId} from Meilisearch`);
	} catch (error) {
		logger.error(
			`Failed to delete facility ${facilityId} from Meilisearch:`,
			error,
		);
		throw error;
	}
}
