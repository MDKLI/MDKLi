import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './User';
import { Doctor } from './Doctor';

@Entity('clinic_profiles')
export class ClinicProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, user => user.clinicProfile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  clinic_name: string;

  @Column()
  photo_url: string;

  @Column()
  city: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  google_maps_url: string;

  @Column('float')
  latitude: number;

  @Column('float')
  longitude: number;

  @Column('text', { array: true })
  phone_numbers: string[];

  @Column({ type: 'enum', enum: ['pending', 'verified', 'suspended'], default: 'pending' })
  status: string;

  @OneToMany(() => Doctor, doctor => doctor.clinic)
  doctors: Doctor[];
}
