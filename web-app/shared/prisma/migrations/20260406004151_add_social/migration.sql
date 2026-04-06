-- DropForeignKey
ALTER TABLE "algorithm_version" DROP CONSTRAINT "algorithm_version_algorithmId_fkey";

-- DropForeignKey
ALTER TABLE "backtesting_results" DROP CONSTRAINT "backtesting_results_creatorId_fkey";

-- AlterTable
ALTER TABLE "algorithm_version" ALTER COLUMN "algorithmId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "backtesting_results" ALTER COLUMN "creatorId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "algorithm_version" ADD CONSTRAINT "algorithm_version_algorithmId_fkey" FOREIGN KEY ("algorithmId") REFERENCES "algorithm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtesting_results" ADD CONSTRAINT "backtesting_results_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
