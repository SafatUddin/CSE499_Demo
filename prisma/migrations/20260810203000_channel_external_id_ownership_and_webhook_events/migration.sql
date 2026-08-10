-- Phase 5: channel provider-identity ownership + webhook event idempotency.
-- Safe: no row deletes. Duplicate (type, externalId) pairs were verified absent
-- before this migration. PostgreSQL UNIQUE allows multiple NULLs for externalId.

-- Backfill Shopify externalId from stored domain so ownership applies to existing
-- connected shops (credentials JSON shape: { domain, token, name }).
UPDATE "Channel"
SET "externalId" = LOWER(TRIM(BOTH FROM (credentials->>'domain')))
WHERE type = 'SHOPIFY'
  AND "externalId" IS NULL
  AND credentials IS NOT NULL
  AND credentials->>'domain' IS NOT NULL
  AND TRIM(BOTH FROM (credentials->>'domain')) <> '';

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_processedAt_idx" ON "WebhookEvent"("processedAt");

-- CreateIndex: provider-scoped channel identity ownership
CREATE UNIQUE INDEX "Channel_type_externalId_key" ON "Channel"("type", "externalId");
