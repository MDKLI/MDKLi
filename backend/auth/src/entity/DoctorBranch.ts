import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	Unique,
	UpdateDateColumn,
} from "typeorm";
import { Branch } from "./Branch";
import { Doctor } from "./Doctor";

@Entity("doctor_branches")
@Unique(["doctorId", "branchId"])
export class DoctorBranch {
	@PrimaryGeneratedColumn("uuid")
	id: string;

	@ManyToOne(
		() => Doctor,
		(doctor) => doctor.doctorBranches,
		{ nullable: false },
	)
	@JoinColumn({ name: "doctor_id" })
	doctor: Doctor;

	@Column({ name: "doctor_id" })
	doctorId: string;

	@ManyToOne(() => Branch, { nullable: false })
	@JoinColumn({ name: "branch_id" })
	branch: Branch;

	@Column({ name: "branch_id" })
	branchId: string;

	@Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
	consultationFee: number;

	@CreateDateColumn({ name: "created_at" })
	createdAt: Date;

	@UpdateDateColumn({ name: "updated_at" })
	updatedAt: Date;
}
