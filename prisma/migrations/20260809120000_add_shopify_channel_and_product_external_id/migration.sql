-- AlterEnum
ALTER TYPE "ChannelType" ADD VALUE 'SHOPIFY';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "externalId" TEXT;
