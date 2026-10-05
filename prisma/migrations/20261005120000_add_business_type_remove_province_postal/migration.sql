-- AlterTable: Add businessType field and remove province and postalCode fields
ALTER TABLE "Store" ADD COLUMN "businessType" TEXT;
ALTER TABLE "Store" DROP COLUMN "province";
ALTER TABLE "Store" DROP COLUMN "postalCode";
