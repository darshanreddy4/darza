-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "impressionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sponsorName" TEXT,
ADD COLUMN     "videoUrl" TEXT;
