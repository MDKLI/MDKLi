import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { User } from './User';
import { ClinicProfile } from './ClinicProfile';

@Entity('doctors')
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, user => user.doctorProfile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => ClinicProfile, clinic => clinic.doctors)
  @JoinColumn({ name: 'clinic_id' })
  clinic: ClinicProfile;

  @Column()
  full_name: string;

  @Column({ nullable: true })
  photo_url: string;

  @Column()
  specialty: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  phone_number: string;

  @Column({ default: true })
  is_active: boolean;
}
