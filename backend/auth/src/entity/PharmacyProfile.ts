import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('pharmacy_profiles')
export class PharmacyProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, user => user.pharmacyProfile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  pharmacy_name: string;

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

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ['pending', 'verified', 'suspended'], default: 'pending' })
  status: string;
}
