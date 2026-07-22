import { AppDataSource } from "../data-source";
import { SearchableDoctor } from "../entities/SearchableDoctor";
import { SearchableFacility } from "../entities/SearchableFacility";
import logger from "../utils/logger";
import {
	deleteDoctorFromMeilisearch,
	deleteFacilityFromMeilisearch,
	syncDoctorToMeilisearch,
	syncFacilityToMeilisearch,
} from "./sync.service";

const doctorRepo = () => AppDataSource.getRepository(SearchableDoctor);
const facilityRepo = () => AppDataSource.getRepository(SearchableFacility);

// Handle doctor created event
export async function handleDoctorCreated(data: any): Promise<void> {
	try {
		logger.info(`Handling doctor.created event: ${data.id}`);

		const existing = await doctorRepo().findOne({ where: { id: data.id } });
		if (existing) {
			logger.warn(`Doctor ${data.id} already exists, updating instead`);
			await handleDoctorUpdated(data);
			return;
		}

		const doctor = doctorRepo().create({
			id: data.id,
			user_id: data.user_id,
			full_name: data.full_name || "Unknown",
			title: data.title,
			specialty: data.specialty,
			years_of_experience: data.years_of_experience?.toString() || null,
			gender: data.gender,
			description: data.description,
			photo_url: data.photo_url,
			phone_number: data.phone_number,
			city: data.city,
			area: data.area,
			has_private_practice: data.has_private_practice ?? false,
			clinic_name: data.clinic_name,
			clinic_type: data.clinic_type,
			branches: data.branches || [],
			verification_status: data.verification_status || "pending",
		});

		await doctorRepo().save(doctor);
		await syncDoctorToMeilisearch(doctor);

		logger.info(`✅ Doctor ${data.id} created in search database`);
	} catch (error) {
		logger.error(`Failed to handle doctor.created event:`, error);
		throw error;
	}
}

// Handle doctor updated event
export async function handleDoctorUpdated(data: any): Promise<void> {
	try {
		logger.info(`Handling doctor.updated event: ${data.id}`);

		const existing = await doctorRepo().findOne({ where: { id: data.id } });
		if (!existing) {
			logger.warn(`Doctor ${data.id} not found, creating instead`);
			await handleDoctorCreated(data);
			return;
		}

		existing.full_name = data.full_name || existing.full_name;
		existing.title = data.title !== undefined ? data.title : existing.title;
		existing.specialty =
			data.specialty !== undefined ? data.specialty : existing.specialty;
		existing.years_of_experience =
			data.years_of_experience?.toString() || existing.years_of_experience;
		existing.gender = data.gender !== undefined ? data.gender : existing.gender;
		existing.description =
			data.description !== undefined ? data.description : existing.description;
		existing.photo_url =
			data.photo_url !== undefined ? data.photo_url : existing.photo_url;
		existing.phone_number =
			data.phone_number !== undefined
				? data.phone_number
				: existing.phone_number;
		existing.city = data.city !== undefined ? data.city : existing.city;
		existing.area = data.area !== undefined ? data.area : existing.area;
		existing.has_private_practice =
			data.has_private_practice != null
				? data.has_private_practice
				: (existing.has_private_practice ?? false);
		existing.clinic_name =
			data.clinic_name !== undefined ? data.clinic_name : existing.clinic_name;
		existing.clinic_type =
			data.clinic_type !== undefined ? data.clinic_type : existing.clinic_type;
		existing.branches = data.branches || existing.branches;
		existing.verification_status =
			data.verification_status || existing.verification_status;

		await doctorRepo().save(existing);
		await syncDoctorToMeilisearch(existing);

		logger.info(`✅ Doctor ${data.id} updated in search database`);
	} catch (error) {
		logger.error(`Failed to handle doctor.updated event:`, error);
		throw error;
	}
}

// Handle doctor deleted event (hard delete from search – not affected by soft-block)
export async function handleDoctorDeleted(data: any): Promise<void> {
	try {
		logger.info(`Handling doctor.deleted event: ${data.id}`);

		const result = await doctorRepo().delete({ id: data.id });
		if (result.affected && result.affected > 0) {
			await deleteDoctorFromMeilisearch(data.id);
			logger.info(`✅ Doctor ${data.id} deleted from search database`);
		} else {
			logger.warn(`Doctor ${data.id} not found in search database`);
		}
	} catch (error) {
		logger.error(`Failed to handle doctor.deleted event:`, error);
		throw error;
	}
}

// Handle facility created event
export async function handleFacilityCreated(data: any): Promise<void> {
	try {
		logger.info(`Handling facility.created event: ${data.id}`);

		const existing = await facilityRepo().findOne({ where: { id: data.id } });
		if (existing) {
			logger.warn(`Facility ${data.id} already exists, updating instead`);
			await handleFacilityUpdated(data);
			return;
		}

		const facility = facilityRepo().create({
			id: data.id,
			user_id: data.user_id,
			facility_name:
				data.facility_name || data.clinic_name || "Unknown Facility",
			facility_type: data.facility_type,
			description: data.description,
			photo_url: data.photo_url,
			phone_numbers: data.phone_numbers || [],
			address: data.address,
			city: data.city,
			area: data.area,
			status: data.status || "pending",
			facility_role:
				data.facility_role ||
				(data.facility_type === "pharmacy" ? "pharmacy" : "clinic"),
			branches: data.branches || [],
		});

		await facilityRepo().save(facility);
		await syncFacilityToMeilisearch(facility);

		logger.info(`✅ Facility ${data.id} created in search database`);
	} catch (error) {
		logger.error(`Failed to handle facility.created event:`, error);
		throw error;
	}
}

// Handle facility updated event
export async function handleFacilityUpdated(data: any): Promise<void> {
	try {
		logger.info(`Handling facility.updated event: ${data.id}`);

		const existing = await facilityRepo().findOne({ where: { id: data.id } });
		if (!existing) {
			logger.warn(`Facility ${data.id} not found, creating instead`);
			await handleFacilityCreated(data);
			return;
		}

		existing.facility_name =
			data.facility_name !== undefined
				? data.facility_name
				: existing.facility_name;
		existing.facility_type =
			data.facility_type !== undefined
				? data.facility_type
				: existing.facility_type;
		existing.description =
			data.description !== undefined ? data.description : existing.description;
		existing.photo_url =
			data.photo_url !== undefined ? data.photo_url : existing.photo_url;
		existing.phone_numbers = data.phone_numbers || existing.phone_numbers;
		existing.address =
			data.address !== undefined ? data.address : existing.address;
		existing.city = data.city !== undefined ? data.city : existing.city;
		existing.area = data.area !== undefined ? data.area : existing.area;
		existing.status = data.status || existing.status;
		existing.facility_role = data.facility_role || existing.facility_role;
		existing.branches = data.branches || existing.branches;

		await facilityRepo().save(existing);
		await syncFacilityToMeilisearch(existing);

		logger.info(`✅ Facility ${data.id} updated in search database`);
	} catch (error) {
		logger.error(`Failed to handle facility.updated event:`, error);
		throw error;
	}
}

// Handle facility deleted event (hard delete)
export async function handleFacilityDeleted(data: any): Promise<void> {
	try {
		logger.info(`Handling facility.deleted event: ${data.id}`);

		const result = await facilityRepo().delete({ id: data.id });
		if (result.affected && result.affected > 0) {
			await deleteFacilityFromMeilisearch(data.id);
			logger.info(`✅ Facility ${data.id} deleted from search database`);
		} else {
			logger.warn(`Facility ${data.id} not found in search database`);
		}
	} catch (error) {
		logger.error(`Failed to handle facility.deleted event:`, error);
		throw error;
	}
}

// --------- Branch handlers (unchanged) ---------

export async function handleBranchCreated(data: any): Promise<void> {
	try {
		logger.info(`Handling branch.created event: ${data.id}`);

		const doctor = await doctorRepo().findOne({
			where: { user_id: data.user_id },
		});
		if (!doctor) {
			logger.warn(`Doctor not found for branch ${data.id}`);
			return;
		}

		const branches = doctor.branches || [];
		const branchExists = branches.some((b: any) => b.id === data.id);

		if (!branchExists) {
			branches.push({
				id: data.id,
				name: data.name,
				city: data.city,
				area: data.area,
				address: data.address,
				phone_numbers: data.phone_numbers,
				consultation_fee: data.consultation_fee,
				branch_type: data.branch_type || "private_practice",
			});

			doctor.branches = branches;
			await doctorRepo().save(doctor);
			await syncDoctorToMeilisearch(doctor);

			logger.info(`✅ Branch ${data.id} added to doctor ${doctor.id}`);
		}
	} catch (error) {
		logger.error(`Failed to handle branch.created event:`, error);
		throw error;
	}
}

export async function handleBranchUpdated(data: any): Promise<void> {
	try {
		logger.info(`Handling branch.updated event: ${data.id}`);

		const doctor = await doctorRepo().findOne({
			where: { user_id: data.user_id },
		});
		if (!doctor) {
			logger.warn(`Doctor not found for branch ${data.id}`);
			return;
		}

		const branches = doctor.branches || [];
		const branchIndex = branches.findIndex((b: any) => b.id === data.id);

		if (branchIndex >= 0) {
			branches[branchIndex] = {
				...branches[branchIndex],
				name: data.name !== undefined ? data.name : branches[branchIndex].name,
				city: data.city !== undefined ? data.city : branches[branchIndex].city,
				area: data.area !== undefined ? data.area : branches[branchIndex].area,
				address:
					data.address !== undefined
						? data.address
						: branches[branchIndex].address,
				phone_numbers:
					data.phone_numbers !== undefined
						? data.phone_numbers
						: branches[branchIndex].phone_numbers,
				consultation_fee:
					data.consultation_fee !== undefined
						? data.consultation_fee
						: branches[branchIndex].consultation_fee,
			};

			doctor.branches = branches;
			await doctorRepo().save(doctor);
			await syncDoctorToMeilisearch(doctor);

			logger.info(`✅ Branch ${data.id} updated for doctor ${doctor.id}`);
		}
	} catch (error) {
		logger.error(`Failed to handle branch.updated event:`, error);
		throw error;
	}
}

export async function handleBranchDeleted(data: any): Promise<void> {
	try {
		logger.info(`Handling branch.deleted event: ${data.id}`);

		const doctors = await doctorRepo().find();

		for (const doctor of doctors) {
			const branches = doctor.branches || [];
			const filteredBranches = branches.filter((b: any) => b.id !== data.id);

			if (filteredBranches.length !== branches.length) {
				doctor.branches = filteredBranches;
				await doctorRepo().save(doctor);
				await syncDoctorToMeilisearch(doctor);
				logger.info(`✅ Branch ${data.id} removed from doctor ${doctor.id}`);
			}
		}
	} catch (error) {
		logger.error(`Failed to handle branch.deleted event:`, error);
		throw error;
	}
}

// --------- Invitation handlers (unchanged) ---------

export async function handleInvitationAccepted(data: any): Promise<void> {
	try {
		logger.info(
			`Handling invitation.accepted event for doctor: ${data.doctor_id}`,
		);
		logger.info(`Invitation accepted processed`);
	} catch (error) {
		logger.error(`Failed to handle invitation.accepted event:`, error);
		throw error;
	}
}

export async function handleInvitationRejected(data: any): Promise<void> {
	try {
		logger.info(
			`Handling invitation.rejected event for doctor: ${data.doctor_id}`,
		);
		logger.info(`Invitation rejected processed`);
	} catch (error) {
		logger.error(`Failed to handle invitation.rejected event:`, error);
		throw error;
	}
}

// =====================
//  Soft‑block / unblock / soft‑delete handlers
//  (used for user.blocked / user.unblocked / user.deleted events)
// =====================

export async function handleUserBlocked(data: any): Promise<void> {
	try {
		logger.info(`Handling user.blocked event for userId: ${data.userId}`);
		const doctor = await doctorRepo().findOne({
			where: { user_id: data.userId },
		});
		if (doctor) {
			doctor.is_blocked = true;
			await doctorRepo().save(doctor);
			await syncDoctorToMeilisearch(doctor);
			logger.info(`✅ Doctor ${doctor.id} marked as blocked`);
		}
		const facility = await facilityRepo().findOne({
			where: { user_id: data.userId },
		});
		if (facility) {
			facility.is_blocked = true;
			await facilityRepo().save(facility);
			await syncFacilityToMeilisearch(facility);
			logger.info(`✅ Facility ${facility.id} marked as blocked`);
		}
	} catch (error) {
		logger.error(`Failed to handle user.blocked:`, error);
		throw error;
	}
}

export async function handleUserUnblocked(data: any): Promise<void> {
	try {
		logger.info(`Handling user.unblocked event for userId: ${data.userId}`);
		const doctor = await doctorRepo().findOne({
			where: { user_id: data.userId },
		});
		if (doctor) {
			doctor.is_blocked = false;
			await doctorRepo().save(doctor);
			await syncDoctorToMeilisearch(doctor);
			logger.info(`✅ Doctor ${doctor.id} unblocked`);
		}
		const facility = await facilityRepo().findOne({
			where: { user_id: data.userId },
		});
		if (facility) {
			facility.is_blocked = false;
			await facilityRepo().save(facility);
			await syncFacilityToMeilisearch(facility);
			logger.info(`✅ Facility ${facility.id} unblocked`);
		}
	} catch (error) {
		logger.error(`Failed to handle user.unblocked:`, error);
		throw error;
	}
}

export async function handleUserDeleted(data: any): Promise<void> {
	// soft‑delete – same as block
	await handleUserBlocked(data);
}
