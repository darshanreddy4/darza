-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "reportEmail" TEXT,
ADD COLUMN     "reportLastSentAt" TIMESTAMP(3),
ADD COLUMN     "reportSchedule" TEXT NOT NULL DEFAULT 'OFF';

