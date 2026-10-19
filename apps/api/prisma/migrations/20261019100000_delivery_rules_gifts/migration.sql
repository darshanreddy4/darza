-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "gifts" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "chargeDelivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deliveryFeePaise" INTEGER;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "deliveryZones" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "freeAllOverPaise" INTEGER,
ADD COLUMN     "giftTiers" JSONB NOT NULL DEFAULT '[]';
