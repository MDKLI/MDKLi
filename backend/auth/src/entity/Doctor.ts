import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { User } from './User';
import { ClinicProfile } from './ClinicProfile';
import { DoctorBranchInvitation } from './DoctorBranchInvitation';
import { DoctorBranch } from './DoctorBranch';

@Entity('doctors')
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, user => user.doctorProfile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => ClinicProfile, clinic => clinic.doctors, { nullable: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic: ClinicProfile;

  @Column({ nullable: true })
  full_name: string;

  @Column({ nullable: true })
  photo_url: string;

  @Column({ nullable: true })
  specialty: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  phone_number: string;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  gender: string;

  @Column({ nullable: true })
  years_of_experience: string;

  @Column({ type: 'boolean', nullable: true })
  has_private_practice: boolean;

  @Column({ default: false })
  is_active: boolean;

  @OneToMany(() => DoctorBranchInvitation, invitation => invitation.doctor)
  invitations: DoctorBranchInvitation[];

  @OneToMany(() => DoctorBranch, doctorBranch => doctorBranch.doctor)
  doctorBranches: DoctorBranch[];
}
