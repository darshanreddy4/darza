-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentId" TEXT;

-- CreateIndex
CREATE INDEX "Order_paymentRef_idx" ON "Order"("paymentRef");
