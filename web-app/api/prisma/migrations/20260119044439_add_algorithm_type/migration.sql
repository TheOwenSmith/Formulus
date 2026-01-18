/*
  Warnings:

  - Added the required column `type` to the `algorithm` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AlgorithmType" AS ENUM ('NORMAL', 'SIMPLE', 'TOP_K');

-- AlterTable
ALTER TABLE "algorithm" ADD COLUMN     "type" "AlgorithmType" NOT NULL;
