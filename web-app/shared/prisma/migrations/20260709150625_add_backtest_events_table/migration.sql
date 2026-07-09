-- CreateTable
CREATE TABLE "backtest_usage_event" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatorId" TEXT NOT NULL,

    CONSTRAINT "backtest_usage_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backtest_usage_event_creatorId_createdAt_idx" ON "backtest_usage_event"("creatorId", "createdAt");

-- AddForeignKey
ALTER TABLE "backtest_usage_event" ADD CONSTRAINT "backtest_usage_event_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
