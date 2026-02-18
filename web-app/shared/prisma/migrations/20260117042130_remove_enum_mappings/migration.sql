/*
  Warnings:

  - The values [1min,5min,15min,30min,60min] on the enum `Timestamp` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Timestamp_new" AS ENUM ('min1', 'min5', 'min15', 'min30', 'min60');
ALTER TABLE "algorithm" ALTER COLUMN "aggregate" TYPE "Timestamp_new" USING ("aggregate"::text::"Timestamp_new");
ALTER TABLE "algorithm_graph" ALTER COLUMN "aggregate" TYPE "Timestamp_new" USING ("aggregate"::text::"Timestamp_new");
ALTER TABLE "ticker_plot" ALTER COLUMN "aggregate" TYPE "Timestamp_new" USING ("aggregate"::text::"Timestamp_new");
ALTER TABLE "description_metrics" ALTER COLUMN "aggregate" TYPE "Timestamp_new" USING ("aggregate"::text::"Timestamp_new");
ALTER TYPE "Timestamp" RENAME TO "Timestamp_old";
ALTER TYPE "Timestamp_new" RENAME TO "Timestamp";
DROP TYPE "public"."Timestamp_old";
COMMIT;
