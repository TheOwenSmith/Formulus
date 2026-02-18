/*
  Warnings:

  - You are about to drop the column `descriptionMetricsId` on the `algorithm_graph` table. All the data in the column will be lost.
  - You are about to drop the `description_metrics` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `algorithmReturn` to the `algorithm_graph` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contextLength` to the `algorithm_graph` table without a default value. This is not possible if the table is not empty.
  - Added the required column `growthRate` to the `algorithm_graph` table without a default value. This is not possible if the table is not empty.
  - Added the required column `maxHoldingPorportion` to the `algorithm_graph` table without a default value. This is not possible if the table is not empty.
  - Added the required column `positionsClosed` to the `algorithm_graph` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profitLossRatio` to the `algorithm_graph` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timespanEnd` to the `algorithm_graph` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timespanStart` to the `algorithm_graph` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tradesMade` to the `algorithm_graph` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "algorithm_graph" DROP CONSTRAINT "algorithm_graph_descriptionMetricsId_fkey";

-- DropIndex
DROP INDEX "algorithm_graph_descriptionMetricsId_key";

-- AlterTable
ALTER TABLE "algorithm_graph" DROP COLUMN "descriptionMetricsId",
ADD COLUMN     "algorithmReturn" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "averageHoldingDuration" DOUBLE PRECISION,
ADD COLUMN     "contextLength" INTEGER NOT NULL,
ADD COLUMN     "expectancyPerTrade" DOUBLE PRECISION,
ADD COLUMN     "growthRate" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "maxHoldingPorportion" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "positionsClosed" INTEGER NOT NULL,
ADD COLUMN     "profitLossRatio" JSONB NOT NULL,
ADD COLUMN     "sharpeRatio" DOUBLE PRECISION,
ADD COLUMN     "tickers" TEXT[],
ADD COLUMN     "timespanEnd" TEXT NOT NULL,
ADD COLUMN     "timespanStart" TEXT NOT NULL,
ADD COLUMN     "tradesMade" INTEGER NOT NULL,
ADD COLUMN     "volatility" DOUBLE PRECISION,
ADD COLUMN     "winRate" DOUBLE PRECISION;

-- DropTable
DROP TABLE "description_metrics";
