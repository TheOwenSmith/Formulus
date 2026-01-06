/*
  Warnings:

  - You are about to drop the `Algorithm` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BacktestingResults` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BacktestingShare` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RefreshToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Algorithm" DROP CONSTRAINT "Algorithm_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "BacktestingResults" DROP CONSTRAINT "BacktestingResults_creatorId_fkey";

-- DropForeignKey
ALTER TABLE "BacktestingShare" DROP CONSTRAINT "BacktestingShare_backtestingResultsId_fkey";

-- DropForeignKey
ALTER TABLE "BacktestingShare" DROP CONSTRAINT "BacktestingShare_userId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "_AlgorithmBacktestingResults" DROP CONSTRAINT "_AlgorithmBacktestingResults_A_fkey";

-- DropForeignKey
ALTER TABLE "_AlgorithmBacktestingResults" DROP CONSTRAINT "_AlgorithmBacktestingResults_B_fkey";

-- DropTable
DROP TABLE "Algorithm";

-- DropTable
DROP TABLE "BacktestingResults";

-- DropTable
DROP TABLE "BacktestingShare";

-- DropTable
DROP TABLE "RefreshToken";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "algorithm" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "aggregate" "Timestamp" NOT NULL,
    "algorithmMaxHoldingProportion" DOUBLE PRECISION,
    "contextLength" INTEGER NOT NULL,
    "indicators" TEXT[],
    "name" VARCHAR(64) NOT NULL,
    "tickers" TEXT[],
    "userAlgorithmImplementationCode" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,

    CONSTRAINT "algorithm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backtestingResults" (
    "id" TEXT NOT NULL,
    "publicId" VARCHAR(12) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatorId" TEXT NOT NULL,

    CONSTRAINT "backtestingResults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backtesting_share" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "backtestingResultsId" TEXT NOT NULL,

    CONSTRAINT "backtesting_share_pkey" PRIMARY KEY ("userId","backtestingResultsId")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "algorithm_creatorId_idx" ON "algorithm"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "algorithm_creatorId_name_key" ON "algorithm"("creatorId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "backtestingResults_publicId_key" ON "backtestingResults"("publicId");

-- CreateIndex
CREATE INDEX "backtestingResults_creatorId_idx" ON "backtestingResults"("creatorId");

-- CreateIndex
CREATE INDEX "backtestingResults_publicId_idx" ON "backtestingResults"("publicId");

-- CreateIndex
CREATE INDEX "backtesting_share_userId_idx" ON "backtesting_share"("userId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "algorithm" ADD CONSTRAINT "algorithm_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtestingResults" ADD CONSTRAINT "backtestingResults_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtesting_share" ADD CONSTRAINT "backtesting_share_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtesting_share" ADD CONSTRAINT "backtesting_share_backtestingResultsId_fkey" FOREIGN KEY ("backtestingResultsId") REFERENCES "backtestingResults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlgorithmBacktestingResults" ADD CONSTRAINT "_AlgorithmBacktestingResults_A_fkey" FOREIGN KEY ("A") REFERENCES "algorithm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlgorithmBacktestingResults" ADD CONSTRAINT "_AlgorithmBacktestingResults_B_fkey" FOREIGN KEY ("B") REFERENCES "backtestingResults"("id") ON DELETE CASCADE ON UPDATE CASCADE;
