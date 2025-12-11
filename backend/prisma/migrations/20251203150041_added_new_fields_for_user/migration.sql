-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "commissionTotal" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "commission" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountLockedUntil" TIMESTAMP(3),
ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failedVerificationAttempts" INTEGER NOT NULL DEFAULT 0;
