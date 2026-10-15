-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "lowStockAlertedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "alertEmail" TEXT,
ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;

