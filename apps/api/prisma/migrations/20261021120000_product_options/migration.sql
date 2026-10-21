-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "optionId" TEXT,
ADD COLUMN     "optionLabel" TEXT;

-- CreateTable
CREATE TABLE "ProductOption" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "pricePaise" INTEGER NOT NULL,
    "mrpPaise" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "costPaise" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductOption_productId_position_idx" ON "ProductOption"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOption_productId_label_key" ON "ProductOption"("productId", "label");

-- AddForeignKey
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
