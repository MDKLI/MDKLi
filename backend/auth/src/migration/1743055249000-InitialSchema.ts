import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1743055249000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Users
        await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "username" character varying NOT NULL,
                "email" character varying NOT NULL,
                "passwordHash" character varying NOT NULL,
                "role" character varying NOT NULL DEFAULT 'patient',
                "totpSecret" character varying,
                "resetToken" character varying,
                "resetTokenExpiry" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_users_username" UNIQUE ("username"),
                CONSTRAINT "UQ_users_email" UNIQUE ("email"),
                CONSTRAINT "PK_users" PRIMARY KEY ("id")
            );
        `);

        // Patient profiles
        await queryRunner.query(`
            CREATE TABLE "patient_profiles" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "full_name" character varying,
                "photo_url" character varying,
                "date_of_birth" date,
                "gender" character varying,
                "blood_type" character varying,
                "has_diabetes" boolean,
                "has_hypertension" boolean,
                "has_heart_disease" boolean,
                "has_asthma" boolean,
                "has_kidney_disease" boolean,
                "is_pregnant" boolean,
                "is_smoker" boolean,
                "has_previous_surgeries" boolean,
                "allergies" text,
                "current_medications" text,
                "family_history" text,
                "other_conditions" text,
                "emergency_contact" jsonb,
                "latitude" double precision,
                "longitude" double precision,
                CONSTRAINT "PK_patient_profiles" PRIMARY KEY ("id"),
                CONSTRAINT "FK_patient_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
            );
        `);

        // Clinic profiles
        await queryRunner.query(`
            CREATE TABLE "clinic_profiles" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "clinic_name" character varying NOT NULL,
                "photo_url" character varying NOT NULL,
                "city" character varying NOT NULL,
                "address" character varying NOT NULL,
                "google_maps_url" character varying,
                "latitude" double precision NOT NULL,
                "longitude" double precision NOT NULL,
                "phone_numbers" text[] NOT NULL,
                "status" character varying DEFAULT 'pending',
                CONSTRAINT "PK_clinic_profiles" PRIMARY KEY ("id"),
                CONSTRAINT "FK_clinic_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
            );
        `);

        // Doctors
        await queryRunner.query(`
            CREATE TABLE "doctors" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "clinic_id" uuid NOT NULL,
                "full_name" character varying NOT NULL,
                "photo_url" character varying,
                "specialty" character varying NOT NULL,
                "description" text,
                "phone_number" character varying,
                "is_active" boolean DEFAULT true,
                CONSTRAINT "PK_doctors" PRIMARY KEY ("id"),
                CONSTRAINT "FK_doctors_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_doctors_clinic" FOREIGN KEY ("clinic_id") REFERENCES "clinic_profiles"("id") ON DELETE CASCADE
            );
        `);

        // Pharmacy profiles
        await queryRunner.query(`
            CREATE TABLE "pharmacy_profiles" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "pharmacy_name" character varying NOT NULL,
                "photo_url" character varying NOT NULL,
                "city" character varying NOT NULL,
                "address" character varying NOT NULL,
                "google_maps_url" character varying,
                "latitude" double precision NOT NULL,
                "longitude" double precision NOT NULL,
                "phone_numbers" text[] NOT NULL,
                "description" text,
                "status" character varying DEFAULT 'pending',
                CONSTRAINT "PK_pharmacy_profiles" PRIMARY KEY ("id"),
                CONSTRAINT "FK_pharmacy_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "pharmacy_profiles"`);
        await queryRunner.query(`DROP TABLE "doctors"`);
        await queryRunner.query(`DROP TABLE "clinic_profiles"`);
        await queryRunner.query(`DROP TABLE "patient_profiles"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }
}
