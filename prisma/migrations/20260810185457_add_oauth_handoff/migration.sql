-- Short-lived opaque OAuth handoff codes (connect / pending / Google exchange).
CREATE TABLE "OAuthHandoff" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "storeId" TEXT,
    "merchantId" TEXT,
    "payload" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthHandoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthHandoff_code_key" ON "OAuthHandoff"("code");
CREATE INDEX "OAuthHandoff_expiresAt_idx" ON "OAuthHandoff"("expiresAt");