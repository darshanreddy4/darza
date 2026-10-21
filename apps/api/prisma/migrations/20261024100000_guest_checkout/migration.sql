-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "guestCheckoutEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "guestCodEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "guestMinAdvancePaise" INTEGER NOT NULL DEFAULT 5000;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "guestCheckout" BOOLEAN NOT NULL DEFAULT false;
