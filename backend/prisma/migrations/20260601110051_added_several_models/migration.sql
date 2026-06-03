/*
  Warnings:

  - The values [DRIVER_ID] on the enum `DeliveryProofType` will be removed. If these variants are still used in the database, this will fail.
  - The values [AWAITING_HANDOVER,IN_TRANSIT,CANCELLED] on the enum `DeliveryStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [PENDING] on the enum `EscrowStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [PENDING,CONFIRMED,DELIVERED,OUT_FOR_DELIVERY,UNPAID] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `actualDelivery` on the `DeliveryInfo` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryInstructions` on the `DeliveryInfo` table. All the data in the column will be lost.
  - You are about to drop the column `deliveryType` on the `DeliveryInfo` table. All the data in the column will be lost.
  - You are about to drop the column `driverName` on the `DeliveryInfo` table. All the data in the column will be lost.
  - You are about to drop the column `driverPhone` on the `DeliveryInfo` table. All the data in the column will be lost.
  - You are about to drop the column `driverVehicleNumber` on the `DeliveryInfo` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `DeliveryInfo` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedDelivery` on the `DeliveryInfo` table. All the data in the column will be lost.
  - You are about to drop the column `handoverConfirmedAt` on the `DeliveryInfo` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `DeliveryInfo` table. All the data in the column will be lost.
  - You are about to drop the column `postalCode` on the `DeliveryInfo` table. All the data in the column will be lost.
  - You are about to drop the column `preferredDeliveryDate` on the `DeliveryInfo` table. All the data in the column will be lost.
  - You are about to drop the column `preferredDeliveryTime` on the `DeliveryInfo` table. All the data in the column will be lost.
  - You are about to drop the column `trackingUrl` on the `DeliveryInfo` table. All the data in the column will be lost.
  - You are about to alter the column `deliveryFee` on the `DeliveryInfo` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to drop the column `uploadedBy` on the `DeliveryProof` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `total` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to drop the column `sellerNote` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `Product` table. All the data in the column will be lost.
  - You are about to alter the column `price` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - Added the required column `uploadedRole` to the `DeliveryProof` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('SELLER_DELIVERY', 'BOLT_DISPATCH', 'BUS_TRANSPORT', 'PICKUP', 'THIRD_PARTY_RIDER', 'OTHER');

-- CreateEnum
CREATE TYPE "DeliveryActor" AS ENUM ('SELLER', 'BUYER', 'SYSTEM', 'ADMIN');

-- AlterEnum
BEGIN;
CREATE TYPE "DeliveryProofType_new" AS ENUM ('HANDOVER_PHOTO', 'WAYBILL', 'DISPATCH_RECEIPT', 'DELIVERY_PHOTO', 'BUYER_SIGNATURE', 'OTP_CONFIRMATION');
ALTER TABLE "DeliveryProof" ALTER COLUMN "type" TYPE "DeliveryProofType_new" USING ("type"::text::"DeliveryProofType_new");
ALTER TYPE "DeliveryProofType" RENAME TO "DeliveryProofType_old";
ALTER TYPE "DeliveryProofType_new" RENAME TO "DeliveryProofType";
DROP TYPE "public"."DeliveryProofType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "DeliveryStatus_new" AS ENUM ('PENDING', 'PROCESSING', 'DISPATCHED', 'DELIVERED', 'FAILED', 'RETURNED');
ALTER TABLE "public"."DeliveryInfo" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "DeliveryInfo" ALTER COLUMN "status" TYPE "DeliveryStatus_new" USING ("status"::text::"DeliveryStatus_new");
ALTER TYPE "DeliveryStatus" RENAME TO "DeliveryStatus_old";
ALTER TYPE "DeliveryStatus_new" RENAME TO "DeliveryStatus";
DROP TYPE "public"."DeliveryStatus_old";
ALTER TABLE "DeliveryInfo" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "EscrowStatus_new" AS ENUM ('HELD', 'RELEASE_PENDING', 'DISPUTED', 'RELEASED', 'REFUNDED', 'FAILED', 'CANCELLED');
ALTER TABLE "public"."Escrow" ALTER COLUMN "releaseStatus" DROP DEFAULT;
ALTER TABLE "Escrow" ALTER COLUMN "releaseStatus" TYPE "EscrowStatus_new" USING ("releaseStatus"::text::"EscrowStatus_new");
ALTER TYPE "EscrowStatus" RENAME TO "EscrowStatus_old";
ALTER TYPE "EscrowStatus_new" RENAME TO "EscrowStatus";
DROP TYPE "public"."EscrowStatus_old";
ALTER TABLE "Escrow" ALTER COLUMN "releaseStatus" SET DEFAULT 'HELD';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'COMPLETED', 'DISPUTED', 'CANCELLED', 'SHIPPED', 'REFUNDED');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "StatusChange" ALTER COLUMN "oldStatus" TYPE "OrderStatus_new" USING ("oldStatus"::text::"OrderStatus_new");
ALTER TABLE "StatusChange" ALTER COLUMN "newStatus" TYPE "OrderStatus_new" USING ("newStatus"::text::"OrderStatus_new");
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';
COMMIT;

-- DropIndex
DROP INDEX "DeliveryInfo_courierService_idx";

-- DropIndex
DROP INDEX "DeliveryInfo_trackingNumber_idx";

-- AlterTable
ALTER TABLE "DeliveryInfo" DROP COLUMN "actualDelivery",
DROP COLUMN "deliveryInstructions",
DROP COLUMN "deliveryType",
DROP COLUMN "driverName",
DROP COLUMN "driverPhone",
DROP COLUMN "driverVehicleNumber",
DROP COLUMN "email",
DROP COLUMN "estimatedDelivery",
DROP COLUMN "handoverConfirmedAt",
DROP COLUMN "notes",
DROP COLUMN "postalCode",
DROP COLUMN "preferredDeliveryDate",
DROP COLUMN "preferredDeliveryTime",
DROP COLUMN "trackingUrl",
ADD COLUMN     "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'SELLER_DELIVERY',
ADD COLUMN     "dispatchNote" TEXT,
ADD COLUMN     "dispatchedAt" TIMESTAMP(3),
ADD COLUMN     "estimatedDeliveryDays" INTEGER,
ALTER COLUMN "deliveryFee" DROP DEFAULT,
ALTER COLUMN "deliveryFee" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "DeliveryProof" DROP COLUMN "uploadedBy",
ADD COLUMN     "note" TEXT,
ADD COLUMN     "uploadedById" TEXT,
ADD COLUMN     "uploadedRole" "DeliveryActor" NOT NULL;

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "resolvedBy" TEXT;

-- AlterTable
ALTER TABLE "Escrow" ALTER COLUMN "releaseStatus" SET DEFAULT 'HELD';

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING_PAYMENT';

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "price" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "sellerNote",
DROP COLUMN "weight",
ALTER COLUMN "price" SET DATA TYPE DECIMAL(65,30);

-- DropEnum
DROP TYPE "DeliverySource";

-- DropEnum
DROP TYPE "DeliveryVerificationStatus";

-- CreateIndex
CREATE INDEX "DeliveryInfo_deliveryMethod_idx" ON "DeliveryInfo"("deliveryMethod");
