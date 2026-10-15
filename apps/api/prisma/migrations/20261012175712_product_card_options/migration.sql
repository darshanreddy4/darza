-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "dealLabel" TEXT,
ADD COLUMN     "deliveryDays" INTEGER,
ADD COLUMN     "freeDelivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showAddToCart" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showRating" BOOLEAN NOT NULL DEFAULT true;
