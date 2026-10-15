-- AlterEnum
ALTER TYPE "AuthTokenType" ADD VALUE 'EMAIL_ADD';

-- AlterTable
ALTER TABLE "AuthToken" ADD COLUMN     "data" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelReason" TEXT;

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "paidOutAt" TIMESTAMP(3),
ADD COLUMN     "payoutRef" TEXT,
ADD COLUMN     "payoutUpi" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "passwordSet" BOOLEAN NOT NULL DEFAULT true;


-- Accounts made with a phone number alone have never had a password they know.
UPDATE "User" SET "passwordSet" = false WHERE "email" IS NULL;
