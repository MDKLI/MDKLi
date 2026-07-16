import {
	Column,
	Entity,
	JoinColumn,
	OneToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./User";

@Entity("patient_profiles")
export class PatientProfile {
	@PrimaryGeneratedColumn("uuid")
	id: string;

	@OneToOne(
		() => User,
		(user) => user.patientProfile,
	)
	@JoinColumn({ name: "user_id" })
	user: User;

	@Column({ nullable: true })
	full_name: string;

	@Column({ nullable: true })
	photo_url: string;

	@Column({ type: "date", nullable: true })
	date_of_birth: Date;

	@Column({ nullable: true })
	gender: string;

	@Column({ nullable: true })
	blood_type: string;

	@Column({ type: "boolean", nullable: true })
	has_diabetes: boolean;

	@Column({ type: "boolean", nullable: true })
	has_hypertension: boolean;

	@Column({ type: "boolean", nullable: true })
	has_heart_disease: boolean;

	@Column({ type: "boolean", nullable: true })
	has_asthma: boolean;

	@Column({ type: "boolean", nullable: true })
	has_kidney_disease: boolean;

	@Column({ type: "boolean", nullable: true })
	is_pregnant: boolean;

	@Column({ nullable: true })
	is_smoker: string;

	@Column({ type: "boolean", nullable: true })
	has_previous_surgeries: boolean;

	@Column({ type: "text", nullable: true })
	allergies: string;

	@Column({ type: "text", nullable: true })
	current_medications: string;

	@Column({ type: "text", nullable: true })
	family_history: string;

	@Column({ type: "text", nullable: true })
	other_conditions: string;

	@Column({ type: "jsonb", nullable: true })
	emergency_contact: any;

	@Column({ type: "float", nullable: true })
	latitude: number;

	@Column({ type: "float", nullable: true })
	longitude: number;
}
