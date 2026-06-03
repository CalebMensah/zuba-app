/*
  Warnings:

  - The values [PROCESSING,SHIPPED,OUT_FOR_DELIVERY] on the enum `DeliveryStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "DeliveryVerificationStatus" AS ENUM ('UNVERIFIED', 'SELLER_CONFIRMED', 'BUYER_CONFIRMED', 'AUTO_CONFIRMED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "DeliveryProofType" AS ENUM ('HANDOVER_PHOTO', 'WAYBILL', 'DRIVER_ID', 'DELIVERY_PHOTO', 'BUYER_SIGNATURE', 'OTP_CONFIRMATION');

-- CreateEnum
CREATE TYPE "DeliverySource" AS ENUM ('PLATFORM_COURIER', 'SELLER_COURIER', 'PUBLIC_TRANSPORT', 'PRIVATE_DRIVER');

-- AlterEnum
BEGIN;
CREATE TYPE "DeliveryStatus_new" AS ENUM ('PENDING', 'AWAITING_HANDOVER', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED');
ALTER TABLE "public"."DeliveryInfo" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "DeliveryInfo" ALTER COLUMN "status" TYPE "DeliveryStatus_new" USING ("status"::text::"DeliveryStatus_new");
ALTER TYPE "DeliveryStatus" RENAME TO "DeliveryStatus_old";
ALTER TYPE "DeliveryStatus_new" RENAME TO "DeliveryStatus";
DROP TYPE "public"."DeliveryStatus_old";
ALTER TABLE "DeliveryInfo" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'PAID';
ALTER TYPE "OrderStatus" ADD VALUE 'UNPAID';

-- AlterTable
ALTER TABLE "DeliveryInfo" ADD COLUMN     "autoReleasedAt" TIMESTAMP(3),
ADD COLUMN     "buyerConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "handoverConfirmedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DeliveryProof" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "type" "DeliveryProofType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryProof_deliveryId_idx" ON "DeliveryProof"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryProof_type_idx" ON "DeliveryProof"("type");

-- AddForeignKey
ALTER TABLE "DeliveryProof" ADD CONSTRAINT "DeliveryProof_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "DeliveryInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
