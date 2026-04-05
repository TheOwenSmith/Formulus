/*
  Warnings:

  - Added the required column `maxDrawdown` to the `algorithm_graph` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "algorithm_graph" ADD COLUMN     "maxDrawdown" DOUBLE PRECISION NOT NULL;
