-- AlterTable
ALTER TABLE "SiteProfile" ADD COLUMN     "announcement" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "announcementOn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "grievanceEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "grievanceOfficer" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gstin" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "legalName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "transparencyNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "transparencyOn" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PolicyPage" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "custom" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyPage_pkey" PRIMARY KEY ("slug")
);

