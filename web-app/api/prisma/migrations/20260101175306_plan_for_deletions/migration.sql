/*
  Warnings:

  - You are about to drop the `_UserSharedBacktestingResults` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Algorithm" DROP CONSTRAINT "Algorithm_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "BacktestingResults" DROP CONSTRAINT "BacktestingResults_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "_UserSharedBacktestingResults" DROP CONSTRAINT "_UserSharedBacktestingResults_A_fkey";

-- DropForeignKey
ALTER TABLE "_UserSharedBacktestingResults" DROP CONSTRAINT "_UserSharedBacktestingResults_B_fkey";

-- DropTable
DROP TABLE "_UserSharedBacktestingResults";

-- CreateTable
CREATE TABLE "BacktestingShare" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "backtestingResultsId" TEXT NOT NULL,

    CONSTRAINT "BacktestingShare_pkey" PRIMARY KEY ("userId","backtestingResultsId")
);

-- CreateIndex
CREATE INDEX "BacktestingShare_userId_idx" ON "BacktestingShare"("userId");

-- AddForeignKey
ALTER TABLE "Algorithm" ADD CONSTRAINT "Algorithm_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestingResults" ADD CONSTRAINT "BacktestingResults_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestingShare" ADD CONSTRAINT "BacktestingShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestingShare" ADD CONSTRAINT "BacktestingShare_backtestingResultsId_fkey" FOREIGN KEY ("backtestingResultsId") REFERENCES "BacktestingResults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
