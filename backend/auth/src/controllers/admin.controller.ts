import type { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { ClinicProfile } from "../entity/ClinicProfile";
import { Doctor } from "../entity/Doctor";
import { PatientProfile } from "../entity/PatientProfile";
import { PharmacyProfile } from "../entity/PharmacyProfile";
import { User } from "../entity/User";
import {
	publishDoctorUpdated,
	publishFacilityUpdated,
	publishUserBlocked,
	publishUserUnblocked,
} from "../services/event-publisher.service";

export const getUserProfile = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const { userId } = req.params;
	const userRepository = AppDataSource.getRepository(User);
	const user = await userRepository.findOne({ where: { id: userId } });

	if (!user) {
		res.status(404).json({ message: "User not found" });
		return;
	}

	let profile: any;
	switch (user.role) {
		case "patient":
			profile = await AppDataSource.getRepository(PatientProfile).findOne({
				where: { user: { id: userId } },
			});
			break;
		case "clinic_admin":
			profile = await AppDataSource.getRepository(ClinicProfile).findOne({
				where: { user: { id: userId } },
			});
			break;
		case "doctor":
			profile = await AppDataSource.getRepository(Doctor).findOne({
				where: { user: { id: userId } },
				relations: ["clinic"],
			});
			break;
		case "pharmacy_admin":
			profile = await AppDataSource.getRepository(PharmacyProfile).findOne({
				where: { user: { id: userId } },
			});
			break;
		default:
			res.status(400).json({ message: "Invalid role" });
			return;
	}

	res.json({ user, profile });
};

export const updateUserProfile = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const { userId } = req.params;
	const updateData = req.body;
	const userRepository = AppDataSource.getRepository(User);
	const user = await userRepository.findOne({ where: { id: userId } });

	if (!user) {
		res.status(404).json({ message: "User not found" });
		return;
	}

	let repo: any;
	let profile: any;

	switch (user.role) {
		case "patient":
			repo = AppDataSource.getRepository(PatientProfile);
			profile = await repo.findOne({ where: { user: { id: userId } } });
			break;
		case "clinic_admin":
			repo = AppDataSource.getRepository(ClinicProfile);
			profile = await repo.findOne({ where: { user: { id: userId } } });
			break;
		case "doctor":
			repo = AppDataSource.getRepository(Doctor);
			profile = await repo.findOne({ where: { user: { id: userId } } });
			break;
		case "pharmacy_admin":
			repo = AppDataSource.getRepository(PharmacyProfile);
			profile = await repo.findOne({ where: { user: { id: userId } } });
			break;
		default:
			res.status(400).json({ message: "Invalid role" });
			return;
	}

	if (!profile) {
		res.status(404).json({ message: "Profile not found" });
		return;
	}

	Object.assign(profile, updateData);
	await (repo as any).save(profile);
	res.json({ message: "Profile updated", profile });
};

export const verifyDoctor = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const { doctorId } = req.params;
	const doctorRepo = AppDataSource.getRepository(Doctor);
	const doctor = await doctorRepo.findOne({ where: { id: doctorId } });
	if (!doctor) {
		res.status(404).json({ message: "Doctor not found" });
		return;
	}
	doctor.is_active = true;
	await doctorRepo.save(doctor);
	await publishDoctorUpdated(doctor.id);
	res.json({ message: "Doctor verified", doctor });
};

export const rejectDoctor = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const { doctorId } = req.params;
	const doctorRepo = AppDataSource.getRepository(Doctor);
	const doctor = await doctorRepo.findOne({ where: { id: doctorId } });
	if (!doctor) {
		res.status(404).json({ message: "Doctor not found" });
		return;
	}
	doctor.is_active = false;
	await doctorRepo.save(doctor);
	await publishDoctorUpdated(doctor.id);
	res.json({ message: "Doctor rejected", doctor });
};

export const verifyFacility = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const { facilityId } = req.params;
	const { type } = req.body; // 'clinic' | 'pharmacy'
	const repo =
		type === "pharmacy"
			? AppDataSource.getRepository(PharmacyProfile)
			: AppDataSource.getRepository(ClinicProfile);
	const facility = await repo.findOne({ where: { id: facilityId } });
	if (!facility) {
		res.status(404).json({ message: "Facility not found" });
		return;
	}
	facility.status = "verified";
	await (repo as any).save(facility);
	await publishFacilityUpdated(
		facility.id,
		type === "pharmacy" ? "pharmacy" : "clinic",
	);
	res.json({ message: "Facility verified", facility });
};

export const rejectFacility = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const { facilityId } = req.params;
	const { type } = req.body;
	const repo =
		type === "pharmacy"
			? AppDataSource.getRepository(PharmacyProfile)
			: AppDataSource.getRepository(ClinicProfile);
	const facility = await repo.findOne({ where: { id: facilityId } });
	if (!facility) {
		res.status(404).json({ message: "Facility not found" });
		return;
	}
	facility.status = "suspended"; // no distinct "rejected" enum value exists — reusing 'suspended'
	await (repo as any).save(facility);
	await publishFacilityUpdated(
		facility.id,
		type === "pharmacy" ? "pharmacy" : "clinic",
	);
	res.json({ message: "Facility rejected", facility });
};

export const blockUser = async (req: Request, res: Response): Promise<void> => {
	const { userId } = req.params;
	const userRepo = AppDataSource.getRepository(User);
	const user = await userRepo.findOne({ where: { id: userId } });
	if (!user) {
		res.status(404).json({ message: "User not found" });
		return;
	}
	user.is_suspended = true;
	user.blocked_at = new Date();
	await userRepo.save(user);
	await publishUserBlocked(user.id);
	res.json({ message: "User blocked", user });
};

export const unblockUser = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const { userId } = req.params;
	const userRepo = AppDataSource.getRepository(User);
	const user = await userRepo.findOne({ where: { id: userId } });
	if (!user) {
		res.status(404).json({ message: "User not found" });
		return;
	}
	user.is_suspended = false;
	user.blocked_at = null as any;
	await userRepo.save(user);
	await publishUserUnblocked(user.id);
	res.json({ message: "User unblocked", user });
};
