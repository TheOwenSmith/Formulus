/*
  Warnings:

  - Added the required column `language` to the `algorithm` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SupportedLanguage" AS ENUM ('javascript', 'python', 'typescript', 'cpp');

-- AlterTable
ALTER TABLE "algorithm" ADD COLUMN     "language" "SupportedLanguage" NOT NULL;
