-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "multiBuyPercent" INTEGER,
ADD COLUMN     "multiBuyQty" INTEGER,
ADD COLUMN     "packSize" TEXT,
ADD COLUMN     "saleTag" TEXT,
ADD COLUMN     "showSold" BOOLEAN NOT NULL DEFAULT true;
