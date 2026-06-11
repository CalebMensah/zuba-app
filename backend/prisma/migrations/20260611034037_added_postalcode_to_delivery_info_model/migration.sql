/*
  Warnings:

  - Added the required column `postalCode` to the `DeliveryInfo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DeliveryInfo" ADD COLUMN     "postalCode" TEXT NOT NULL;
