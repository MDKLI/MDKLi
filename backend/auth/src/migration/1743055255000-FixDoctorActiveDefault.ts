import type { MigrationInterface, QueryRunner } from "typeorm";

export class FixDoctorActiveDefault1743055255000 implements MigrationInterface {
	name = "FixDoctorActiveDefault1743055255000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "doctors" ALTER COLUMN "is_active" SET DEFAULT false`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "doctors" ALTER COLUMN "is_active" SET DEFAULT true`);
	}
}
