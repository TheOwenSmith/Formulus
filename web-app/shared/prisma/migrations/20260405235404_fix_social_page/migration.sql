-- AlterTable
ALTER TABLE "backtesting_results" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "backtesting_share" ADD COLUMN     "allowCopy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dismissedByRecipient" BOOLEAN NOT NULL DEFAULT false;
