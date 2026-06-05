/*
  Warnings:

  - Made the column `name` on table `backtesting_submission` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "backtesting_submission" ALTER COLUMN "name" SET NOT NULL;
