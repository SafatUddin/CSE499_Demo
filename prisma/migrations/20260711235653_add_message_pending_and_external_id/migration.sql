-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "pending" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Message_externalId_key" ON "Message"("externalId");

