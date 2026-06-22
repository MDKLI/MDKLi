import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('searchable_doctors')
export class SearchableDoctor {
  @PrimaryColumn('uuid')
  id!: string

  @Column()
  user_id!: string

  @Column()
  full_name!: string

  @Column({ type: 'varchar', nullable: true })
  title!: string | null

  @Column({ type: 'varchar', nullable: true })
  specialty!: string | null

  @Column({ type: 'varchar', nullable: true })
  years_of_experience!: string | null

  @Column({ type: 'varchar', nullable: true })
  gender!: string | null

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Column({ type: 'varchar', nullable: true })
  photo_url!: string | null

  @Column({ type: 'varchar', nullable: true })
  phone_number!: string | null

  @Column({ type: 'varchar', nullable: true })
  city!: string | null

  @Column({ type: 'varchar', nullable: true })
  area!: string | null

  @Column({ type: 'boolean', default: false })
  has_private_practice!: boolean

  @Column({ type: 'varchar', nullable: true })
  clinic_name!: string | null

  @Column({ type: 'varchar', nullable: true })
  clinic_type!: string | null

  @Column({ type: 'simple-json', nullable: true })
  branches!: any[] | null

  @Column({ type: 'varchar', default: 'pending' })
  verification_status!: string

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date
}
