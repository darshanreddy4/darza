-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[];
