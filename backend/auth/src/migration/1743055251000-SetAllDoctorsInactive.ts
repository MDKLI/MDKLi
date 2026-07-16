import type { MigrationInterface, QueryRunner } from "typeorm";

export class SetAllDoctorsInactive1743055251000 implements MigrationInterface {
	name = "SetAllDoctorsInactive1743055251000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Set all existing doctors to is_active = false
		await queryRunner.query(`UPDATE doctors SET is_active = false`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Revert: set all doctors back to is_active = true
		await queryRunner.query(`UPDATE doctors SET is_active = true`);
	}
}
