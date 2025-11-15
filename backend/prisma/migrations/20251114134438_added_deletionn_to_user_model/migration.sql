-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletionCode" VARCHAR(6),
ADD COLUMN     "deletionExpiry" TIMESTAMP(3);
