-- CreateEnum
CREATE TYPE "BacktestingSubmissionStatus" AS ENUM ('PENDING', 'RUNNING', 'FINISHED', 'ERROR');

-- CreateTable
CREATE TABLE "algorithm_version" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "AlgorithmType" NOT NULL,
    "aggregate" "Timestamp" NOT NULL,
    "algorithmMaxHoldingProportion" DOUBLE PRECISION,
    "contextLength" INTEGER NOT NULL,
    "indicators" TEXT[],
    "name" VARCHAR(64) NOT NULL,
    "tickers" TEXT[],
    "userAlgorithmImplementationCode" TEXT NOT NULL,
    "k" INTEGER,
    "language" "SupportedLanguage" NOT NULL,
    "algorithmId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "algorithm_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backtesting_submission" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publicId" VARCHAR(12) NOT NULL,
    "status" "BacktestingSubmissionStatus" NOT NULL,
    "progressPct" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "message" TEXT,
    "error" TEXT,
    "startTimespan" TEXT,
    "endTimespan" TEXT,
    "creatorId" TEXT NOT NULL,
    "resultId" TEXT,

    CONSTRAINT "backtesting_submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "backtesting_submission_publicId_key" ON "backtesting_submission"("publicId");

-- CreateIndex
CREATE INDEX "backtesting_submission_creatorId_idx" ON "backtesting_submission"("creatorId");

-- CreateIndex
CREATE INDEX "backtesting_submission_publicId_idx" ON "backtesting_submission"("publicId");

-- AddForeignKey
ALTER TABLE "algorithm_version" ADD CONSTRAINT "algorithm_version_algorithmId_fkey" FOREIGN KEY ("algorithmId") REFERENCES "algorithm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "algorithm_version" ADD CONSTRAINT "algorithm_version_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "backtesting_submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtesting_submission" ADD CONSTRAINT "backtesting_submission_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtesting_submission" ADD CONSTRAINT "backtesting_submission_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "backtesting_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
