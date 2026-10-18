-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "sellerName" SET DEFAULT '';

-- AlterTable
ALTER TABLE "SiteProfile" ADD COLUMN     "siteUrl" TEXT NOT NULL DEFAULT '';

-- From now on the brand name is read from the admin settings. Text that said "DMG" becomes the
-- {brand} placeholder so it follows the brand name wherever it is shown.
UPDATE "Product" SET "sellerName" = '' WHERE "productType" = 'OWN' AND "sellerName" = 'DMG';
UPDATE "Product" SET "affiliateDisclosure" = replace("affiliateDisclosure", 'DMG', '{brand}') WHERE "affiliateDisclosure" LIKE '%DMG%';
UPDATE "HomeWidget" SET "config" = replace("config"::text, 'DMG', '{brand}')::jsonb WHERE "config"::text LIKE '%DMG%';
UPDATE "Banner" SET
  "title" = replace("title", 'DMG', '{brand}'),
  "subtitle" = replace("subtitle", 'DMG', '{brand}'),
  "ctaLabel" = replace("ctaLabel", 'DMG', '{brand}'),
  "sponsorName" = replace("sponsorName", 'DMG', '{brand}');
