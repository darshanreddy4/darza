-- CreateEnum
CREATE TYPE "ReviewMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "returnDays" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "returnDays" INTEGER;

-- CreateTable
CREATE TABLE "ReviewMedia" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "type" "ReviewMediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReviewMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewMedia_reviewId_idx" ON "ReviewMedia"("reviewId");

-- AddForeignKey
ALTER TABLE "ReviewMedia" ADD CONSTRAINT "ReviewMedia_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
