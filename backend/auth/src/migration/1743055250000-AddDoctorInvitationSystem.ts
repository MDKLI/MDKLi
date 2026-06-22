import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableUnique, TableIndex } from "typeorm";

export class AddDoctorInvitationSystem1743055250000 implements MigrationInterface {
  name = 'AddDoctorInvitationSystem1743055250000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create invitation_status_enum
    await queryRunner.query(`
      CREATE TYPE invitation_status_enum AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');
    `);

    // Create doctor_branch_invitations table
    await queryRunner.createTable(
      new Table({
        name: 'doctor_branch_invitations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'doctor_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'facility_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'invited_by_user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'invitation_status_enum',
            default: "'pending'",
          },
          {
            name: 'message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Add foreign keys for doctor_branch_invitations
    await queryRunner.createForeignKey(
      'doctor_branch_invitations',
      new TableForeignKey({
        columnNames: ['doctor_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'doctors',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'doctor_branch_invitations',
      new TableForeignKey({
        columnNames: ['facility_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'clinic_profiles',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'doctor_branch_invitations',
      new TableForeignKey({
        columnNames: ['invited_by_user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      })
    );

    // Create indexes for doctor lookup
    await queryRunner.createIndex(
      'doctor_branch_invitations',
      new TableIndex({
        name: 'idx_invitations_doctor',
        columnNames: ['doctor_id'],
      })
    );

    await queryRunner.createIndex(
      'doctor_branch_invitations',
      new TableIndex({
        name: 'idx_invitations_facility',
        columnNames: ['facility_id'],
      })
    );

    await queryRunner.createIndex(
      'doctor_branch_invitations',
      new TableIndex({
        name: 'idx_invitations_status',
        columnNames: ['status'],
      })
    );

    // Create doctor_branch_invitation_branches table
    await queryRunner.createTable(
      new Table({
        name: 'doctor_branch_invitation_branches',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'invitation_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'branch_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'consultation_fee',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Add foreign keys for doctor_branch_invitation_branches
    await queryRunner.createForeignKey(
      'doctor_branch_invitation_branches',
      new TableForeignKey({
        columnNames: ['invitation_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'doctor_branch_invitations',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'doctor_branch_invitation_branches',
      new TableForeignKey({
        columnNames: ['branch_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'branches',
        onDelete: 'CASCADE',
      })
    );

    // Create unique constraint to prevent duplicate invitations
    await queryRunner.createUniqueConstraint(
      'doctor_branch_invitation_branches',
      new TableUnique({
        name: 'unique_invitation_branch',
        columnNames: ['invitation_id', 'branch_id'],
      })
    );

    // Create doctor_branches table (for accepted assignments)
    await queryRunner.createTable(
      new Table({
        name: 'doctor_branches',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'doctor_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'branch_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'consultation_fee',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Add foreign keys for doctor_branches
    await queryRunner.createForeignKey(
      'doctor_branches',
      new TableForeignKey({
        columnNames: ['doctor_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'doctors',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'doctor_branches',
      new TableForeignKey({
        columnNames: ['branch_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'branches',
        onDelete: 'CASCADE',
      })
    );

    // Create unique constraint to prevent duplicate assignments
    await queryRunner.createUniqueConstraint(
      'doctor_branches',
      new TableUnique({
        name: 'unique_doctor_branch',
        columnNames: ['doctor_id', 'branch_id'],
      })
    );

    // Create indexes for efficient lookups
    await queryRunner.createIndex(
      'doctor_branches',
      new TableIndex({
        name: 'idx_doctor_branches_doctor',
        columnNames: ['doctor_id'],
      })
    );

    await queryRunner.createIndex(
      'doctor_branches',
      new TableIndex({
        name: 'idx_doctor_branches_branch',
        columnNames: ['branch_id'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.dropTable('doctor_branches');
    await queryRunner.dropTable('doctor_branch_invitation_branches');
    await queryRunner.dropTable('doctor_branch_invitations');
    await queryRunner.query(`DROP TYPE invitation_status_enum;`);
  }
}
