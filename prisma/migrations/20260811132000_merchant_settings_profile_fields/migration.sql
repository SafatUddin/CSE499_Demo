-- Migration: merchant_settings_profile_fields
-- Adds optional phone to Merchant and 7 optional business contact/address fields to Store.
-- All additions use ADD COLUMN with no NOT NULL constraint so existing rows are unaffected.

-- Merchant: optional phone number
ALTER TABLE "Merchant" ADD COLUMN "phone" TEXT;

-- Store: business contact
ALTER TABLE "Store" ADD COLUMN "businessPhone" TEXT;
ALTER TABLE "Store" ADD COLUMN "website" TEXT;

-- Store: business address
ALTER TABLE "Store" ADD COLUMN "streetAddress" TEXT;
ALTER TABLE "Store" ADD COLUMN "city" TEXT;
ALTER TABLE "Store" ADD COLUMN "province" TEXT;
ALTER TABLE "Store" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "Store" ADD COLUMN "country" TEXT;
