import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('pharmacy_profiles')
export class PharmacyProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, user => user.pharmacyProfile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  pharmacy_name: string;

  @Column({ nullable: true })
  photo_url: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  google_maps_url: string;

  @Column('float', { nullable: true })
  latitude: number;

  @Column('float', { nullable: true })
  longitude: number;

  @Column('text', { array: true, nullable: true })
  phone_numbers: string[];

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  facility_type: string;

  @Column({ type: 'enum', enum: ['pending', 'verified', 'suspended'], default: 'pending' })
  status: string;
}
