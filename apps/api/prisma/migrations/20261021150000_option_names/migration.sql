-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "optionNames" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "ProductOption" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "values" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Options made before they were named: one unnamed choice, now called "Size".
UPDATE "ProductOption" SET "values" = ARRAY["label"];
UPDATE "Product" SET "optionNames" = ARRAY['Size'] WHERE EXISTS (SELECT 1 FROM "ProductOption" o WHERE o."productId" = "Product"."id");
