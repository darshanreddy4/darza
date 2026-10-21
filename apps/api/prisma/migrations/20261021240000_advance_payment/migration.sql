-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "advancePaise" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "advancePercent" INTEGER,
ADD COLUMN     "onlineOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "payoutPaise" INTEGER;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "advanceEnabled" BOOLEAN NOT NULL DEFAULT false;
