import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Doctor } from './Doctor';
import { ClinicProfile } from './ClinicProfile';
import { User } from './User';
import { DoctorBranchInvitationBranch } from './DoctorBranchInvitationBranch';
import { InvitationStatus } from '../enums/invitation-status.enum';

@Entity('doctor_branch_invitations')
export class DoctorBranchInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Doctor, doctor => doctor.invitations, { nullable: false })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id' })
  doctorId: string;

  @ManyToOne(() => ClinicProfile, clinic => clinic.doctorInvitations, { nullable: false })
  @JoinColumn({ name: 'facility_id' })
  facility: ClinicProfile;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'invited_by_user_id' })
  invitedBy: User;

  @Column({ name: 'invited_by_user_id' })
  invitedByUserId: string;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @Column({ type: 'text', nullable: true })
  message: string;

  @OneToMany(() => DoctorBranchInvitationBranch, branch => branch.invitation, { cascade: true })
  invitationBranches: DoctorBranchInvitationBranch[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
