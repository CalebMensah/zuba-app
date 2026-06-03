-- AlterEnum
ALTER TYPE "ChatRoomType" ADD VALUE 'DIRECT';

-- DropForeignKey
ALTER TABLE "ChatRoom" DROP CONSTRAINT "ChatRoom_orderId_fkey";

-- DropForeignKey
ALTER TABLE "ChatRoom" DROP CONSTRAINT "ChatRoom_productId_fkey";

-- DropIndex
DROP INDEX "ChatRoom_orderId_idx";

-- DropIndex
DROP INDEX "ChatRoom_productId_idx";

-- AlterTable
ALTER TABLE "ChatRoom" ADD COLUMN     "otherUserId" TEXT,
ALTER COLUMN "type" SET DEFAULT 'GENERAL';

-- CreateIndex
CREATE INDEX "ChatRoom_otherUserId_idx" ON "ChatRoom"("otherUserId");

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
