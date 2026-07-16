-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'WALLET');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'SUCCESS', 'FAILED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppointmentStatus" ADD VALUE 'PENDING_PAYMENT';
ALTER TYPE "AppointmentStatus" ADD VALUE 'PAYMENT_FAILED';

-- AlterTable
ALTER TABLE "availability_overrides" ADD COLUMN     "doctor_id" TEXT;

-- AlterTable
ALTER TABLE "availability_rules" ADD COLUMN     "doctor_id" TEXT;

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "area" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "consultation_fee" INTEGER,
ADD COLUMN     "google_maps_url" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "media_urls" TEXT[],
ADD COLUMN     "owner_user_id" TEXT,
ADD COLUMN     "phone_numbers" TEXT[],
ALTER COLUMN "doctor_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "branch_assignments" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "consultation_fee" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "paymob_order_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branch_assignments_branch_id_doctor_id_key" ON "branch_assignments"("branch_id", "doctor_id");

-- CreateIndex
CREATE INDEX "payment_transactions_appointment_id_idx" ON "payment_transactions"("appointment_id");

-- CreateIndex
CREATE INDEX "payment_transactions_paymob_order_id_idx" ON "payment_transactions"("paymob_order_id");

-- AddForeignKey
ALTER TABLE "branch_assignments" ADD CONSTRAINT "branch_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_assignments" ADD CONSTRAINT "branch_assignments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
