-- CreateTable
CREATE TABLE "HomeWidget" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeWidget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeWidget_position_idx" ON "HomeWidget"("position");
