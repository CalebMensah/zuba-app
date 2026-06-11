-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED';

-- AlterTable
ALTER TABLE "DeliveryInfo" ALTER COLUMN "postalCode" DROP NOT NULL;
