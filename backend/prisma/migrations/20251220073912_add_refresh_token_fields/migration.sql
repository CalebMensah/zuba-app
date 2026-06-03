-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastTokenRefreshAttempt" TIMESTAMP(3),
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "refreshTokenCreatedAt" TIMESTAMP(3),
ADD COLUMN     "refreshTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "refreshTokenUsed" BOOLEAN NOT NULL DEFAULT false;
