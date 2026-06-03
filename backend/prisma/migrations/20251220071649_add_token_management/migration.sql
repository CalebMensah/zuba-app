-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('EXPO', 'FCM', 'WEB_PUSH');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "devicePlatform" TEXT,
ADD COLUMN     "lastTokenRefresh" TIMESTAMP(3),
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "tokenType" "TokenType" DEFAULT 'EXPO';
