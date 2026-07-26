import { type MigrationInterface, type QueryRunner, TableColumn } from "typeorm";

export class FixSignupSchemaDrift1743055254000 implements MigrationInterface {
	name = "FixSignupSchemaDrift1743055254000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		// --- users: missing moderation columns (User entity) ---
		await queryRunner.addColumns("users", [
			new TableColumn({ name: "is_suspended", type: "boolean", default: false, isNullable: false }),
			new TableColumn({ name: "blocked_at", type: "timestamp", isNullable: true }),
			new TableColumn({ name: "deleted_at", type: "timestamp", isNullable: true }),
		]);

		// --- patient_profiles: is_smoker is boolean in DB, entity/frontend send a string ("never"/"former"/"current") ---
		await queryRunner.changeColumn(
			"patient_profiles",
			"is_smoker",
			new TableColumn({ name: "is_smoker", type: "character varying", isNullable: true }),
		);

		// --- doctors: missing columns + clinic_id/full_name/specialty must be nullable (private-practice doctors have no clinic) ---
		await queryRunner.addColumns("doctors", [
			new TableColumn({ name: "title", type: "character varying", isNullable: true }),
			new TableColumn({ name: "gender", type: "character varying", isNullable: true }),
			new TableColumn({ name: "years_of_experience", type: "character varying", isNullable: true }),
			new TableColumn({ name: "has_private_practice", type: "boolean", isNullable: true }),
		]);
		await queryRunner.query(`ALTER TABLE "doctors" ALTER COLUMN "clinic_id" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "doctors" ALTER COLUMN "full_name" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "doctors" ALTER COLUMN "specialty" DROP NOT NULL`);

		// --- clinic_profiles: facility_type/description missing; address fields no longer collected at facility level (now per-branch) ---
		await queryRunner.addColumns("clinic_profiles", [
			new TableColumn({ name: "facility_type", type: "character varying", isNullable: true }),
			new TableColumn({ name: "description", type: "text", isNullable: true }),
		]);
		await queryRunner.query(`ALTER TABLE "clinic_profiles" ALTER COLUMN "photo_url" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "clinic_profiles" ALTER COLUMN "city" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "clinic_profiles" ALTER COLUMN "address" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "clinic_profiles" ALTER COLUMN "latitude" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "clinic_profiles" ALTER COLUMN "longitude" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "clinic_profiles" ALTER COLUMN "phone_numbers" DROP NOT NULL`);

		// --- pharmacy_profiles: same story as clinic_profiles ---
		await queryRunner.addColumns("pharmacy_profiles", [
			new TableColumn({ name: "facility_type", type: "character varying", isNullable: true }),
		]);
		await queryRunner.query(`ALTER TABLE "pharmacy_profiles" ALTER COLUMN "photo_url" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "pharmacy_profiles" ALTER COLUMN "city" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "pharmacy_profiles" ALTER COLUMN "address" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "pharmacy_profiles" ALTER COLUMN "latitude" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "pharmacy_profiles" ALTER COLUMN "longitude" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "pharmacy_profiles" ALTER COLUMN "phone_numbers" DROP NOT NULL`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "pharmacy_profiles" ALTER COLUMN "phone_numbers" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "pharmacy_profiles" ALTER COLUMN "longitude" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "pharmacy_profiles" ALTER COLUMN "latitude" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "pharmacy_profiles" ALTER COLUMN "address" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "pharmacy_profiles" ALTER COLUMN "city" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "pharmacy_profiles" ALTER COLUMN "photo_url" SET NOT NULL`);
		await queryRunner.dropColumn("pharmacy_profiles", "facility_type");

		await queryRunner.query(`ALTER TABLE "clinic_profiles" ALTER COLUMN "phone_numbers" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "clinic_profiles" ALTER COLUMN "longitude" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "clinic_profiles" ALTER COLUMN "latitude" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "clinic_profiles" ALTER COLUMN "address" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "clinic_profiles" ALTER COLUMN "city" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "clinic_profiles" ALTER COLUMN "photo_url" SET NOT NULL`);
		await queryRunner.dropColumn("clinic_profiles", "description");
		await queryRunner.dropColumn("clinic_profiles", "facility_type");

		await queryRunner.query(`ALTER TABLE "doctors" ALTER COLUMN "specialty" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "doctors" ALTER COLUMN "full_name" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "doctors" ALTER COLUMN "clinic_id" SET NOT NULL`);
		await queryRunner.dropColumn("doctors", "has_private_practice");
		await queryRunner.dropColumn("doctors", "years_of_experience");
		await queryRunner.dropColumn("doctors", "gender");
		await queryRunner.dropColumn("doctors", "title");

		await queryRunner.changeColumn(
			"patient_profiles",
			"is_smoker",
			new TableColumn({ name: "is_smoker", type: "boolean", isNullable: true }),
		);

		await queryRunner.dropColumn("users", "deleted_at");
		await queryRunner.dropColumn("users", "blocked_at");
		await queryRunner.dropColumn("users", "is_suspended");
	}
}
