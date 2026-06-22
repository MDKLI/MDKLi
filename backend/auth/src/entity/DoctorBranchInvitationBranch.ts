import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DoctorBranchInvitation } from './DoctorBranchInvitation';
import { Branch } from './Branch';

@Entity('doctor_branch_invitation_branches')
export class DoctorBranchInvitationBranch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DoctorBranchInvitation, invitation => invitation.invitationBranches, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invitation_id' })
  invitation: DoctorBranchInvitation;

  @Column({ name: 'invitation_id' })
  invitationId: string;

  @ManyToOne(() => Branch, { nullable: false })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  consultationFee: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
