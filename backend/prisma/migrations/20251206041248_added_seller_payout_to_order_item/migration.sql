/*
  Warnings:

  - You are about to drop the column `storeId` on the `CartItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CartItem" DROP COLUMN "storeId";

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "sellerPayout" DOUBLE PRECISION,
ADD COLUMN     "storeId" TEXT;
