/*
  Warnings:

  - A unique constraint covering the columns `[cartId,productId,color,size]` on the table `CartItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "CartItem_cartId_productId_key";

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "color" TEXT,
ADD COLUMN     "size" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "color" TEXT,
ADD COLUMN     "size" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_color_size_key" ON "CartItem"("cartId", "productId", "color", "size");
