-- CreateTable
CREATE TABLE "doctor_settings" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "auto_accept" BOOLEAN NOT NULL DEFAULT false,
    "notice_period" TEXT NOT NULL DEFAULT '24_hours',
    "buffer_time" INTEGER NOT NULL DEFAULT 0,
    "max_daily_bookings" INTEGER NOT NULL DEFAULT 10,
    "max_weekly_bookings" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_settings_doctor_id_key" ON "doctor_settings"("doctor_id");

-- AddForeignKey
ALTER TABLE "doctor_settings" ADD CONSTRAINT "doctor_settings_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
