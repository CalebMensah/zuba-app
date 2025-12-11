-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "photoURL" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;
