/*
  Warnings:

  - A unique constraint covering the columns `[stripeCustomerId]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeSubscriptionId]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - Made the column `name` on table `backtesting_results` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "backtesting_results" ALTER COLUMN "name" SET NOT NULL;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripePlanActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_stripeCustomerId_key" ON "user"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "user_stripeSubscriptionId_key" ON "user"("stripeSubscriptionId");
