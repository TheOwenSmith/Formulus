/*
  Warnings:

  - You are about to drop the column `algorithmGraphId` on the `description_metrics` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "description_metrics_algorithmGraphId_idx";

-- DropIndex
DROP INDEX "description_metrics_algorithmGraphId_key";

-- AlterTable
ALTER TABLE "description_metrics" DROP COLUMN "algorithmGraphId";
