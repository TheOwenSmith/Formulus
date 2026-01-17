/*
  Warnings:

  - Added the required column `timestampsByAggregate` to the `backtesting_results` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "backtesting_results" ADD COLUMN     "timestampsByAggregate" JSON NOT NULL;

-- CreateTable
CREATE TABLE "algorithm_graph" (
    "id" TEXT NOT NULL,
    "aggregate" "Timestamp" NOT NULL,
    "descriptionMetricsId" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "plotYs" DOUBLE PRECISION[],
    "backtestingResultsId" TEXT NOT NULL,

    CONSTRAINT "algorithm_graph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticker_plot" (
    "id" TEXT NOT NULL,
    "aggregate" "Timestamp" NOT NULL,
    "ticker" VARCHAR(5) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "plotYs" DOUBLE PRECISION[],
    "backtestingResultsId" TEXT NOT NULL,

    CONSTRAINT "ticker_plot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "description_metrics" (
    "id" TEXT NOT NULL,
    "aggregate" "Timestamp" NOT NULL,
    "algorithmReturn" DOUBLE PRECISION NOT NULL,
    "averageHoldingDuration" DOUBLE PRECISION,
    "contextLength" INTEGER NOT NULL,
    "expectancyPerTrade" DOUBLE PRECISION,
    "growthRate" DOUBLE PRECISION NOT NULL,
    "maxHoldingPorportion" DOUBLE PRECISION NOT NULL,
    "positionsClosed" INTEGER NOT NULL,
    "profitLossRatio" JSONB NOT NULL,
    "sharpeRatio" DOUBLE PRECISION,
    "tickers" TEXT[],
    "timespanStart" TEXT NOT NULL,
    "timespanEnd" TEXT NOT NULL,
    "tradesMade" INTEGER NOT NULL,
    "volatility" DOUBLE PRECISION,
    "winRate" DOUBLE PRECISION,
    "algorithmGraphId" TEXT NOT NULL,

    CONSTRAINT "description_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "algorithm_graph_descriptionMetricsId_key" ON "algorithm_graph"("descriptionMetricsId");

-- CreateIndex
CREATE INDEX "algorithm_graph_backtestingResultsId_idx" ON "algorithm_graph"("backtestingResultsId");

-- CreateIndex
CREATE INDEX "ticker_plot_backtestingResultsId_idx" ON "ticker_plot"("backtestingResultsId");

-- CreateIndex
CREATE UNIQUE INDEX "description_metrics_algorithmGraphId_key" ON "description_metrics"("algorithmGraphId");

-- CreateIndex
CREATE INDEX "description_metrics_algorithmGraphId_idx" ON "description_metrics"("algorithmGraphId");

-- AddForeignKey
ALTER TABLE "algorithm_graph" ADD CONSTRAINT "algorithm_graph_descriptionMetricsId_fkey" FOREIGN KEY ("descriptionMetricsId") REFERENCES "description_metrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "algorithm_graph" ADD CONSTRAINT "algorithm_graph_backtestingResultsId_fkey" FOREIGN KEY ("backtestingResultsId") REFERENCES "backtesting_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticker_plot" ADD CONSTRAINT "ticker_plot_backtestingResultsId_fkey" FOREIGN KEY ("backtestingResultsId") REFERENCES "backtesting_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
