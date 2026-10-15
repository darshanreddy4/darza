-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "buttonPosition" TEXT,
ADD COLUMN     "textPosition" TEXT NOT NULL DEFAULT 'middle-left';
