-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "codFeePaise" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "codEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "codFeePaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "codMaxOrderPaise" INTEGER;
