/*
  Warnings:

  - Added the required column `email` to the `DeliveryInfo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DeliveryInfo" ADD COLUMN     "email" TEXT NOT NULL;
