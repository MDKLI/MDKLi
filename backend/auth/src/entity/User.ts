import {
	Column,
	CreateDateColumn,
	Entity,
	OneToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { ClinicProfile } from "./ClinicProfile";
import { Doctor } from "./Doctor";
import { PatientProfile } from "./PatientProfile";
import { PharmacyProfile } from "./PharmacyProfile";

export enum UserRole {
	PATIENT = "patient",
	CLINIC_ADMIN = "clinic_admin",
	DOCTOR = "doctor",
	PHARMACY_ADMIN = "pharmacy_admin",
	ADMIN = "admin",
	SUPER_ADMIN = "superadmin",
}

@Entity("users")
export class User {
	@PrimaryGeneratedColumn("uuid")
	id: string;

	@Column({ unique: true })
	username: string;

	@Column({ unique: true })
	email: string;

	@Column()
	passwordHash: string;

	@Column({ type: "enum", enum: UserRole, default: UserRole.PATIENT })
	role: UserRole;

	@Column({ nullable: true })
	totpSecret: string;

	@Column({ nullable: true })
	resetToken?: string;

	@Column({ type: "timestamp", nullable: true })
	resetTokenExpiry?: Date;

	@Column({ default: false })
	is_suspended: boolean;

	@Column({ type: "timestamp", nullable: true })
	blocked_at?: Date;

	@Column({ type: "timestamp", nullable: true })
	deleted_at?: Date;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;

	@OneToOne(
		() => PatientProfile,
		(profile) => profile.user,
		{ nullable: true },
	)
	patientProfile: PatientProfile;

	@OneToOne(
		() => ClinicProfile,
		(profile) => profile.user,
		{ nullable: true },
	)
	clinicProfile: ClinicProfile;

	@OneToOne(
		() => Doctor,
		(doctor) => doctor.user,
		{ nullable: true },
	)
	doctorProfile: Doctor;

	@OneToOne(
		() => PharmacyProfile,
		(profile) => profile.user,
		{ nullable: true },
	)
	pharmacyProfile: PharmacyProfile;
}
