import type { MigrationInterface, QueryRunner } from "typeorm";

export class SetAllPharmaciesPending1743055253000
	implements MigrationInterface
{
	name = "SetAllPharmaciesPending1743055253000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Set all existing pharmacies to status = 'pending'
		await queryRunner.query(`UPDATE pharmacy_profiles SET status = 'pending'`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Revert: this migration cannot be safely reverted
		// as we don't know previous statuses
		await queryRunner.query(`UPDATE pharmacy_profiles SET status = 'pending'`);
	}
}
