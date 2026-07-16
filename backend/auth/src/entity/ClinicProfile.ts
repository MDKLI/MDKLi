import {
	Column,
	Entity,
	JoinColumn,
	OneToMany,
	OneToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { Doctor } from "./Doctor";
import { DoctorBranchInvitation } from "./DoctorBranchInvitation";
import { User } from "./User";

@Entity("clinic_profiles")
export class ClinicProfile {
	@PrimaryGeneratedColumn("uuid")
	id: string;

	@OneToOne(
		() => User,
		(user) => user.clinicProfile,
	)
	@JoinColumn({ name: "user_id" })
	user: User;

	@Column({ nullable: true })
	clinic_name: string;

	@Column({ nullable: true })
	photo_url: string;

	@Column({ nullable: true })
	city: string;

	@Column({ nullable: true })
	address: string;

	@Column({ nullable: true })
	google_maps_url: string;

	@Column("float", { nullable: true })
	latitude: number;

	@Column("float", { nullable: true })
	longitude: number;

	@Column("text", { array: true, nullable: true })
	phone_numbers: string[];

	@Column({
		type: "enum",
		enum: ["pending", "verified", "suspended"],
		default: "pending",
	})
	status: string;

	@Column({ nullable: true })
	facility_type: string;

	@Column({ type: "text", nullable: true })
	description: string;

	@OneToMany(
		() => Doctor,
		(doctor) => doctor.clinic,
	)
	doctors: Doctor[];

	@OneToMany(
		() => DoctorBranchInvitation,
		(invitation) => invitation.facility,
	)
	doctorInvitations: DoctorBranchInvitation[];
}
