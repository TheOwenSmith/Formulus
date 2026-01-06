/*
  Warnings:

  - You are about to drop the `backtestingResults` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_AlgorithmBacktestingResults" DROP CONSTRAINT "_AlgorithmBacktestingResults_B_fkey";

-- DropForeignKey
ALTER TABLE "backtestingResults" DROP CONSTRAINT "backtestingResults_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "backtesting_share" DROP CONSTRAINT "backtesting_share_backtestingResultsId_fkey";

-- DropTable
DROP TABLE "backtestingResults";

-- CreateTable
CREATE TABLE "backtesting_results" (
    "id" TEXT NOT NULL,
    "publicId" VARCHAR(12) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatorId" TEXT NOT NULL,

    CONSTRAINT "backtesting_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "backtesting_results_publicId_key" ON "backtesting_results"("publicId");

-- CreateIndex
CREATE INDEX "backtesting_results_creatorId_idx" ON "backtesting_results"("creatorId");

-- CreateIndex
CREATE INDEX "backtesting_results_publicId_idx" ON "backtesting_results"("publicId");

-- CreateIndex
CREATE INDEX "backtesting_share_backtestingResultsId_idx" ON "backtesting_share"("backtestingResultsId");

-- AddForeignKey
ALTER TABLE "backtesting_results" ADD CONSTRAINT "backtesting_results_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtesting_share" ADD CONSTRAINT "backtesting_share_backtestingResultsId_fkey" FOREIGN KEY ("backtestingResultsId") REFERENCES "backtesting_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlgorithmBacktestingResults" ADD CONSTRAINT "_AlgorithmBacktestingResults_B_fkey" FOREIGN KEY ("B") REFERENCES "backtesting_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
