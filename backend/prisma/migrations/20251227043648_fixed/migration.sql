/*
  Warnings:

  - You are about to drop the column `devicePlatform` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `fcmToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lastTokenRefresh` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `tokenExpiresAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `tokenType` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('android', 'ios', 'web');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "devicePlatform",
DROP COLUMN "fcmToken",
DROP COLUMN "lastTokenRefresh",
DROP COLUMN "tokenExpiresAt",
DROP COLUMN "tokenType";

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tokenType" "TokenType" NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "deviceId" TEXT,
    "appVersion" TEXT,
    "deviceModel" TEXT,
    "osVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastFailedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- CreateIndex
CREATE INDEX "PushToken_tokenType_idx" ON "PushToken"("tokenType");

-- CreateIndex
CREATE INDEX "PushToken_revokedAt_idx" ON "PushToken"("revokedAt");

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
