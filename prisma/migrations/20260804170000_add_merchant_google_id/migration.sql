-- Make passwordHash optional so Google-only merchants can be created without one.
ALTER TABLE "Merchant" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Add googleId: the Google subject (sub) as a stable, unique link to a Google account.
ALTER TABLE "Merchant" ADD COLUMN "googleId" TEXT;
CREATE UNIQUE INDEX "Merchant_googleId_key" ON "Merchant"("googleId");
