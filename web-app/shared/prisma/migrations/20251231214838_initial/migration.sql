-- CreateEnum
CREATE TYPE "Timestamp" AS ENUM ('1min', '5min', '15min', '30min', '60min');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" VARCHAR(64) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Algorithm" (
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

    CONSTRAINT "Algorithm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestingResults" (
    "id" TEXT NOT NULL,
    "publicId" VARCHAR(12) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creatorId" TEXT NOT NULL,

    CONSTRAINT "BacktestingResults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AlgorithmBacktestingResults" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AlgorithmBacktestingResults_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_UserSharedBacktestingResults" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserSharedBacktestingResults_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Algorithm_creatorId_idx" ON "Algorithm"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Algorithm_creatorId_name_key" ON "Algorithm"("creatorId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BacktestingResults_publicId_key" ON "BacktestingResults"("publicId");

-- CreateIndex
CREATE INDEX "BacktestingResults_creatorId_idx" ON "BacktestingResults"("creatorId");

-- CreateIndex
CREATE INDEX "BacktestingResults_publicId_idx" ON "BacktestingResults"("publicId");

-- CreateIndex
CREATE INDEX "_AlgorithmBacktestingResults_B_index" ON "_AlgorithmBacktestingResults"("B");

-- CreateIndex
CREATE INDEX "_UserSharedBacktestingResults_B_index" ON "_UserSharedBacktestingResults"("B");

-- AddForeignKey
ALTER TABLE "Algorithm" ADD CONSTRAINT "Algorithm_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestingResults" ADD CONSTRAINT "BacktestingResults_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlgorithmBacktestingResults" ADD CONSTRAINT "_AlgorithmBacktestingResults_A_fkey" FOREIGN KEY ("A") REFERENCES "Algorithm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlgorithmBacktestingResults" ADD CONSTRAINT "_AlgorithmBacktestingResults_B_fkey" FOREIGN KEY ("B") REFERENCES "BacktestingResults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserSharedBacktestingResults" ADD CONSTRAINT "_UserSharedBacktestingResults_A_fkey" FOREIGN KEY ("A") REFERENCES "BacktestingResults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserSharedBacktestingResults" ADD CONSTRAINT "_UserSharedBacktestingResults_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
