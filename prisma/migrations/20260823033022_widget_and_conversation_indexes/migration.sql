-- CreateIndex
CREATE INDEX "Conversation_storeId_idx" ON "Conversation"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_storeId_channelType_externalUserId_key" ON "Conversation"("storeId", "channelType", "externalUserId");

-- CreateIndex
CREATE INDEX "Order_storeId_idx" ON "Order"("storeId");
