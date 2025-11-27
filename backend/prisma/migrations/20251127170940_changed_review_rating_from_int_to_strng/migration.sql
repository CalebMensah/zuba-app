/*
  Warnings:

  - Added the required column `rating` to the `Review` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Review" DROP COLUMN "rating",
ADD COLUMN     "rating" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");
