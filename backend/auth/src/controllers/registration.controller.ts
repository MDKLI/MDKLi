import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import type { QueryRunner } from "typeorm";
import { AppDataSource } from "../data-source";
import { Branch } from "../entity/Branch";
import { ClinicProfile } from "../entity/ClinicProfile";
import { Doctor } from "../entity/Doctor";
import { PatientProfile } from "../entity/PatientProfile";
import { PharmacyProfile } from "../entity/PharmacyProfile";
import { User, type UserRole } from "../entity/User";
import {
	publishBranchCreated,
	publishDoctorCreated,
	publishFacilityCreated,
	publishUserCreated,
} from "../services/event-publisher.service";
import { MediaService } from "../services/media.service";
import logger from "../utility/logger";

const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret";

// In-memory store for pending registrations (use Redis in production)
const pendingRegistrations = new Map<string, any>();
const PENDING_TTL = 30 * 60 * 1000; // 30 minutes

// Generate unique token for pending registration
function generatePendingToken(): string {
	return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Start registration (temporary)
export const startRegistration = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		res.status(400).json({ errors: errors.array() });
		return;
	}

	try {
		const { username, email, password, role, profileData } = req.body;

		// Validate role
		const allowedRoles = [
			"patient",
			"clinic_admin",
			"doctor",
			"pharmacy_admin",
		];
		if (!allowedRoles.includes(role)) {
			res.status(400).json({ message: "Invalid role" });
			return;
		}

		// Check if user already exists
		const userRepository = AppDataSource.getRepository(User);
		const existingUser = await userRepository.findOne({
			where: [{ username }, { email }],
		});

		if (existingUser) {
			res.status(400).json({ message: "Username or email already exists" });
			return;
		}

		// Generate temporary token
		const pendingToken = generatePendingToken();

		// Store pending registration
		pendingRegistrations.set(pendingToken, {
			username,
			email,
			password,
			role,
			profileData,
			createdAt: Date.now(),
		});

		// Clean up old entries
		const now = Date.now();
		for (const [key, value] of pendingRegistrations.entries()) {
			if (now - value.createdAt > PENDING_TTL) {
				pendingRegistrations.delete(key);
			}
		}

		res.status(201).json({
			message: "Registration started",
			pendingToken,
			role,
		});
	} catch (error) {
		logger.error("Start registration error:", error);
		res.status(500).json({ message: "Internal server error" });
	}
};

// Complete registration (after onboarding)
export const completeRegistration = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		logger.error("Validation errors:", JSON.stringify(errors.array(), null, 2));
		logger.error("Request body:", JSON.stringify(req.body, null, 2));
		res.status(400).json({ errors: errors.array() });
		return;
	}

	const queryRunner = AppDataSource.createQueryRunner();
	await queryRunner.connect();
	await queryRunner.startTransaction();

	try {
		const { pendingToken, onboardingData } = req.body;

		logger.info(
			"completeRegistration called with onboardingData:",
			JSON.stringify(onboardingData, null, 2),
		);

		// Get pending registration
		const pending = pendingRegistrations.get(pendingToken);
		if (!pending) {
			res.status(400).json({ message: "Registration expired or invalid" });
			return;
		}

		const { username, email, password, role, profileData } = pending;

		// Check again if user exists (in case of race condition)
		const userRepository = queryRunner.manager.getRepository(User);
		const existingUser = await userRepository.findOne({
			where: [{ username }, { email }],
		});

		if (existingUser) {
			res.status(400).json({ message: "Username or email already exists" });
			return;
		}

		// Create user
		const passwordHash = await bcrypt.hash(password, 10);
		const user = userRepository.create({
			username,
			email,
			passwordHash,
			role: role as UserRole,
		});
		await queryRunner.manager.save(user);

		// Create profile based on role
		switch (role) {
			case "patient": {
				const patientProfile = new PatientProfile();

				// Map profile data from onboardingData (sent from frontend localStorage)
				patientProfile.full_name = onboardingData.full_name;
				patientProfile.gender = onboardingData.gender;
				patientProfile.date_of_birth = onboardingData.date_of_birth;
				patientProfile.blood_type = onboardingData.blood_type;
				patientProfile.is_smoker = onboardingData.is_smoker;
				patientProfile.allergies = onboardingData.allergies;
				patientProfile.current_medications = onboardingData.current_medications;
				patientProfile.family_history = onboardingData.family_history;
				patientProfile.emergency_contact = onboardingData.emergency_contact;

				patientProfile.user = user;

				logger.info(
					"Creating patient profile with data:",
					JSON.stringify(patientProfile, null, 2),
				);
				await queryRunner.manager.save(patientProfile);
				logger.info("Patient profile saved successfully");
				setImmediate(() => {
					publishUserCreated(user.id).catch((err) => {
						logger.error("Failed to publish user created event:", err);
					});
				});
				break;
			}
			case "clinic_admin": {
				const clinicProfile = new ClinicProfile();

				// Map profile data from onboardingData (sent from frontend localStorage)
				clinicProfile.clinic_name =
					onboardingData.clinic_name ||
					onboardingData.facility_name ||
					onboardingData.facilityName;
				clinicProfile.photo_url = onboardingData.photo_url;
				clinicProfile.phone_numbers =
					onboardingData.phone_numbers ||
					(onboardingData.phone_number ? [onboardingData.phone_number] : []);
				clinicProfile.facility_type = onboardingData.facility_type;
				clinicProfile.description = onboardingData.description;
				clinicProfile.address = onboardingData.address;
				clinicProfile.city = onboardingData.city;

				clinicProfile.user = user;
				clinicProfile.status = "pending";

				logger.info(
					"Creating clinic profile with data:",
					JSON.stringify(clinicProfile, null, 2),
				);
				await queryRunner.manager.save(clinicProfile);
				logger.info("Clinic profile saved successfully");

				// Create branches if provided
				if (onboardingData.branches && onboardingData.branches.length > 0) {
					await createBranches(queryRunner, user, onboardingData.branches);
				}

				// Publish event to RabbitMQ (after transaction commits)
				setImmediate(() => {
					publishFacilityCreated(clinicProfile.id, "clinic").catch((err) => {
						logger.error("Failed to publish facility created event:", err);
					});
				});
				break;
			}
			case "doctor": {
				const doctorProfile = new Doctor();

				// Map profile data from onboardingData (sent from frontend localStorage)
				doctorProfile.full_name = onboardingData.full_name;
				doctorProfile.photo_url = onboardingData.photo_url;
				doctorProfile.phone_number = onboardingData.phone_number;
				doctorProfile.title = onboardingData.title;
				doctorProfile.specialty = onboardingData.specialty;
				doctorProfile.years_of_experience = onboardingData.years_of_experience;
				doctorProfile.gender = onboardingData.gender;
				doctorProfile.description = onboardingData.description;
				doctorProfile.has_private_practice =
					onboardingData.has_private_practice;

				doctorProfile.user = user;

				logger.info(
					"Creating doctor profile with mapped data:",
					JSON.stringify(doctorProfile, null, 2),
				);
				await queryRunner.manager.save(doctorProfile);
				logger.info("Doctor profile saved successfully");

				// Create branches if provided
				if (onboardingData.branches && onboardingData.branches.length > 0) {
					await createBranches(queryRunner, user, onboardingData.branches);
				}

				// Publish event to RabbitMQ (after transaction commits)
				setImmediate(() => {
					publishDoctorCreated(doctorProfile.id).catch((err) => {
						logger.error("Failed to publish doctor created event:", err);
					});
				});
				break;
			}
			case "pharmacy_admin": {
				const pharmacyProfile = new PharmacyProfile();

				// Map profile data from onboardingData (sent from frontend localStorage)
				pharmacyProfile.pharmacy_name =
					onboardingData.pharmacy_name ||
					onboardingData.facility_name ||
					onboardingData.facilityName;
				pharmacyProfile.photo_url = onboardingData.photo_url;
				pharmacyProfile.phone_numbers =
					onboardingData.phone_numbers ||
					(onboardingData.phone_number ? [onboardingData.phone_number] : []);
				pharmacyProfile.facility_type = onboardingData.facility_type;
				pharmacyProfile.description = onboardingData.description;
				pharmacyProfile.address = onboardingData.address;
				pharmacyProfile.city = onboardingData.city;

				pharmacyProfile.user = user;
				pharmacyProfile.status = "pending";

				logger.info(
					"Creating pharmacy profile with data:",
					JSON.stringify(pharmacyProfile, null, 2),
				);
				await queryRunner.manager.save(pharmacyProfile);
				logger.info("Pharmacy profile saved successfully");

				// Create branches if provided
				if (onboardingData.branches && onboardingData.branches.length > 0) {
					await createBranches(queryRunner, user, onboardingData.branches);
				}

				// Publish event to RabbitMQ (after transaction commits)
				setImmediate(() => {
					publishFacilityCreated(pharmacyProfile.id, "pharmacy").catch(
						(err) => {
							logger.error("Failed to publish facility created event:", err);
						},
					);
				});
				break;
			}
			default:
				throw new Error("Unsupported role");
		}

		// Remove pending registration
		pendingRegistrations.delete(pendingToken);

		// Generate token
		const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
			expiresIn: "1h",
		});

		await queryRunner.commitTransaction();

		res.status(201).json({
			message: "Registration completed successfully",
			userId: user.id,
			role: user.role,
			token,
		});
	} catch (error) {
		await queryRunner.rollbackTransaction();
		logger.error("Complete registration error:", error);
		res.status(500).json({
			message: error instanceof Error ? error.message : "Internal server error",
		});
	} finally {
		await queryRunner.release();
	}
};

// Check if pending registration exists
export const checkPendingRegistration = async (
	req: Request,
	res: Response,
): Promise<void> => {
	try {
		const { pendingToken } = req.params;
		const pending = pendingRegistrations.get(pendingToken);

		if (!pending) {
			res.status(404).json({ message: "Registration not found or expired" });
			return;
		}

		// Check if expired
		if (Date.now() - pending.createdAt > PENDING_TTL) {
			pendingRegistrations.delete(pendingToken);
			res.status(404).json({ message: "Registration expired" });
			return;
		}

		res.json({
			role: pending.role,
			email: pending.email,
		});
	} catch (error) {
		logger.error("Check pending registration error:", error);
		res.status(500).json({ message: "Internal server error" });
	}
};

// Helper function to create branches during registration
async function createBranches(
	queryRunner: QueryRunner,
	user: User,
	branchesData: any[],
): Promise<void> {
	const branchRepo = queryRunner.manager.getRepository(Branch);

	for (const branchData of branchesData) {
		const branch = new Branch();
		branch.user = user;
		branch.name = branchData.name;
		branch.city = branchData.cityId || branchData.city;
		branch.area = branchData.area;
		branch.address = branchData.address;
		branch.google_maps_url = branchData.googleMapsUrl || null;
		branch.phone_numbers = branchData.phoneNumbers || [];
		branch.consultation_fee = branchData.consultationFee || null;

		// Extract lat/lng from Google Maps URL if present
		if (branchData.googleMapsUrl) {
			const latLngMatch = branchData.googleMapsUrl.match(
				/@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
			);
			if (latLngMatch) {
				branch.latitude = parseFloat(latLngMatch[1]);
				branch.longitude = parseFloat(latLngMatch[2]);
			}
		}

		// Handle media URLs - upload base64 images to MinIO
		if (branchData.mediaUrls && branchData.mediaUrls.length > 0) {
			const uploadedUrls: string[] = [];

			for (let i = 0; i < branchData.mediaUrls.length; i++) {
				const mediaUrl = branchData.mediaUrls[i];

				// Check if it's a base64 string
				if (mediaUrl.startsWith("data:image")) {
					try {
						// Extract base64 data
						const base64Data = mediaUrl.split(",")[1];
						const buffer = Buffer.from(base64Data, "base64");

						// Determine file extension from mime type
						const mimeMatch = mediaUrl.match(/data:image\/(\w+);base64/);
						const extension = mimeMatch ? mimeMatch[1] : "jpg";

						// Generate filename
						const timestamp = Date.now();
						const fileName = `branch-${user.id}-${timestamp}-${i}.${extension}`;

						// Upload to MinIO
						const uploadedUrl = await MediaService.uploadFile(
							buffer,
							fileName,
							`image/${extension}`,
							"branches",
						);

						uploadedUrls.push(uploadedUrl);
					} catch (error) {
						logger.error("Error uploading branch media:", error);
						// Skip this image but continue
					}
				} else {
					// Already a URL, keep it
					uploadedUrls.push(mediaUrl);
				}
			}

			branch.media_urls = uploadedUrls;
		}

		await branchRepo.save(branch);

		// Publish branch created event
		publishBranchCreated(branch.id, user.id).catch((err) => {
			logger.error("Failed to publish branch.created event:", err);
		});
	}
}
