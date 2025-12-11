-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paystackFee" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "verification_audit_logs" (
    "id" TEXT NOT NULL,
    "verificationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_audit_logs_verificationId_idx" ON "verification_audit_logs"("verificationId");

-- CreateIndex
CREATE INDEX "verification_audit_logs_performedBy_idx" ON "verification_audit_logs"("performedBy");

-- CreateIndex
CREATE INDEX "verification_audit_logs_createdAt_idx" ON "verification_audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "verification_audit_logs" ADD CONSTRAINT "verification_audit_logs_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "StoreVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_audit_logs" ADD CONSTRAINT "verification_audit_logs_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
