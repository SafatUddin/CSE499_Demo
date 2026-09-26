-- Migration: add_share_business_info_toggle
-- Adds shareBusinessInfo boolean field to Store table to control whether AI should share business contact info with customers
-- Defaults to true (enabled) for existing stores

ALTER TABLE "Store" ADD COLUMN "shareBusinessInfo" BOOLEAN NOT NULL DEFAULT true;
