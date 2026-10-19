-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "colorName" TEXT,
ADD COLUMN     "manufacturerInfo" TEXT,
ADD COLUMN     "saleEndsAt" TIMESTAMP(3),
ADD COLUMN     "salePricePaise" INTEGER,
ADD COLUMN     "variantGroup" TEXT,
ADD COLUMN     "warranty" TEXT;
