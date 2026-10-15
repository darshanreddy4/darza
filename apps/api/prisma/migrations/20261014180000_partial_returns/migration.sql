-- DropIndex
DROP INDEX "ReturnRequest_orderId_key";

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "returnedQty" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "refundPaise" INTEGER;

-- CreateTable
CREATE TABLE "ReturnItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReturnItem_requestId_idx" ON "ReturnItem"("requestId");

-- CreateIndex
CREATE INDEX "ReturnItem_orderItemId_idx" ON "ReturnItem"("orderItemId");

-- CreateIndex
CREATE INDEX "ReturnRequest_orderId_idx" ON "ReturnRequest"("orderId");

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Returns made before this change covered the whole order: give each one a line per item.
INSERT INTO "ReturnItem" ("id", "requestId", "orderItemId", "quantity")
SELECT md5(random()::text || clock_timestamp()::text || oi."id"), r."id", oi."id", oi."quantity"
FROM "ReturnRequest" r JOIN "OrderItem" oi ON oi."orderId" = r."orderId";

UPDATE "OrderItem" oi SET "returnedQty" = oi."quantity"
WHERE EXISTS (SELECT 1 FROM "ReturnRequest" r WHERE r."orderId" = oi."orderId" AND r."status" = 'REFUNDED');

UPDATE "ReturnRequest" r SET "refundPaise" = o."totalPaise"
FROM "Order" o WHERE o."id" = r."orderId" AND r."status" = 'REFUNDED';
