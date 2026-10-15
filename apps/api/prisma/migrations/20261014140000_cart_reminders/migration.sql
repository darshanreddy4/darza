-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cartRemindersOff" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CartSnapshot" (
    "userId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remindedAt" TIMESTAMP(3),

    CONSTRAINT "CartSnapshot_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "CartSnapshot_remindedAt_savedAt_idx" ON "CartSnapshot"("remindedAt", "savedAt");

-- AddForeignKey
ALTER TABLE "CartSnapshot" ADD CONSTRAINT "CartSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

