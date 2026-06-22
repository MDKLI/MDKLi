import { MigrationInterface, QueryRunner } from "typeorm";

export class SetAllClinicsPending1743055252000 implements MigrationInterface {
    name = 'SetAllClinicsPending1743055252000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Set all existing clinics to status = 'pending'
        await queryRunner.query(`UPDATE clinic_profiles SET status = 'pending'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert: this migration cannot be safely reverted
        // as we don't know previous statuses
        await queryRunner.query(`UPDATE clinic_profiles SET status = 'pending'`);
    }
}
