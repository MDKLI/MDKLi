import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

@Entity('searchable_facilities')
export class SearchableFacility {
  @PrimaryColumn('uuid')
  id!: string

  @Column()
  user_id!: string

  @Column()
  facility_name!: string

  @Column({ type: 'varchar', nullable: true })
  facility_type!: string | null

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Column({ type: 'varchar', nullable: true })
  photo_url!: string | null

  @Column({ type: 'simple-json', nullable: true })
  phone_numbers!: string[] | null

  @Column({ type: 'varchar', nullable: true })
  address!: string | null

  @Column({ type: 'varchar', nullable: true })
  city!: string | null

  @Column({ type: 'varchar', nullable: true })
  area!: string | null

  @Column({ type: 'simple-json', nullable: true })
  branches!: any[] | null

  @Column({ type: 'varchar', default: 'pending' })
  status!: string

  @Column({ type: 'varchar', default: 'clinic' })
  facility_role!: string // 'clinic' or 'pharmacy'

  @CreateDateColumn()
  created_at!: Date

  @UpdateDateColumn()
  updated_at!: Date
}
