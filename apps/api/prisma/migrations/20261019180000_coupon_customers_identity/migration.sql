-- CreateTable
CREATE TABLE "CouponCustomer" (
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CouponCustomer_pkey" PRIMARY KEY ("couponId","userId")
);

-- CreateIndex
CREATE INDEX "CouponCustomer_userId_idx" ON "CouponCustomer"("userId");

-- AddForeignKey
ALTER TABLE "CouponCustomer" ADD CONSTRAINT "CouponCustomer_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCustomer" ADD CONSTRAINT "CouponCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A personal code becomes a code with one chosen customer.
INSERT INTO "CouponCustomer" ("couponId", "userId") SELECT "id", "userId" FROM "Coupon" WHERE "userId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Coupon" DROP CONSTRAINT "Coupon_userId_fkey";

-- AlterTable
ALTER TABLE "Coupon" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "buyerEmailKey" TEXT,
ADD COLUMN     "buyerPhoneKey" TEXT,
ADD COLUMN     "shipPhoneKey" TEXT;

-- Keys for orders placed before this change (same rules as store/identity.ts: lower case, no +tag, no dots for Gmail; last 10 digits of a phone).
UPDATE "Order" o SET
  "buyerEmailKey" = CASE
    WHEN u."email" IS NULL OR position('@' in u."email") = 0 THEN NULL
    WHEN split_part(lower(u."email"), '@', 2) IN ('gmail.com', 'googlemail.com')
      THEN replace(split_part(split_part(lower(u."email"), '@', 1), '+', 1), '.', '') || '@gmail.com'
    ELSE split_part(split_part(lower(u."email"), '@', 1), '+', 1) || '@' || split_part(lower(u."email"), '@', 2)
  END,
  "buyerPhoneKey" = CASE WHEN u."phone" IS NULL OR length(regexp_replace(u."phone", '\D', '', 'g')) < 10 THEN NULL ELSE right(regexp_replace(u."phone", '\D', '', 'g'), 10) END,
  "shipPhoneKey" = CASE WHEN length(regexp_replace(coalesce(o."shippingAddr"->>'phone', ''), '\D', '', 'g')) < 10 THEN NULL ELSE right(regexp_replace(o."shippingAddr"->>'phone', '\D', '', 'g'), 10) END
FROM "User" u WHERE u."id" = o."userId";

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_couponId_status_idx" ON "Order"("couponId", "status");

-- CreateIndex
CREATE INDEX "Order_buyerEmailKey_idx" ON "Order"("buyerEmailKey");

-- CreateIndex
CREATE INDEX "Order_buyerPhoneKey_idx" ON "Order"("buyerPhoneKey");

-- CreateIndex
CREATE INDEX "Order_shipPhoneKey_idx" ON "Order"("shipPhoneKey");
