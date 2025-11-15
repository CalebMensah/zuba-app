-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StoreView" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreView_storeId_userId_idx" ON "StoreView"("storeId", "userId");

-- CreateIndex
CREATE INDEX "StoreView_viewedAt_idx" ON "StoreView"("viewedAt");

-- CreateIndex
CREATE INDEX "Store_viewCount_idx" ON "Store"("viewCount");

-- AddForeignKey
ALTER TABLE "StoreView" ADD CONSTRAINT "StoreView_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
