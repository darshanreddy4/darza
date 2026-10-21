-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "sku" TEXT,
ADD COLUMN     "weightGrams" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "weightGrams" INTEGER;

-- AlterTable
ALTER TABLE "ProductOption" ADD COLUMN     "lowStockAlertedAt" TIMESTAMP(3),
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "weightGrams" INTEGER;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "optionStockAlerts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skuWeightEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "ProductOption_sku_key" ON "ProductOption"("sku");
