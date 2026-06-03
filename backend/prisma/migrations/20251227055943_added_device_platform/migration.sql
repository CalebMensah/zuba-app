/*
  Warnings:

  - The values [android,ios,web] on the enum `DevicePlatform` will be removed. If these variants are still used in the database, this will fail.
  - Changed the type of `tokenType` on the `PushToken` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DevicePlatform_new" AS ENUM ('ANDROID', 'IOS', 'WEB');
ALTER TABLE "PushToken" ALTER COLUMN "platform" TYPE "DevicePlatform_new" USING ("platform"::text::"DevicePlatform_new");
ALTER TYPE "DevicePlatform" RENAME TO "DevicePlatform_old";
ALTER TYPE "DevicePlatform_new" RENAME TO "DevicePlatform";
DROP TYPE "public"."DevicePlatform_old";
COMMIT;

-- AlterTable
ALTER TABLE "PushToken" DROP COLUMN "tokenType",
ADD COLUMN     "tokenType" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "PushToken_tokenType_idx" ON "PushToken"("tokenType");
