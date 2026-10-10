CREATE TYPE "AppointmentStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

ALTER TABLE "Message"
  ADD COLUMN "audioUrl" TEXT,
  ADD COLUMN "transcript" TEXT,
  ADD COLUMN "mediaType" TEXT;

CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "conversationId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "service" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "advanceAmount" DECIMAL(12,2),
    "advancePaymentMethod" TEXT,
    "advanceTransactionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Appointment_storeId_startsAt_idx" ON "Appointment"("storeId", "startsAt");
CREATE INDEX "Appointment_storeId_status_idx" ON "Appointment"("storeId", "status");

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
