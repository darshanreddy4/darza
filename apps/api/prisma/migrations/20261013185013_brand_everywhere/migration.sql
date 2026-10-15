-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "sellerName" SET DEFAULT '';

-- AlterTable
ALTER TABLE "SiteProfile" ADD COLUMN     "siteUrl" TEXT NOT NULL DEFAULT '';

-- From now on the brand name is read from the admin settings. Text that said "Darza" becomes the
-- {brand} placeholder so it follows the brand name wherever it is shown.
UPDATE "Product" SET "sellerName" = '' WHERE "productType" = 'OWN' AND "sellerName" = 'Darza';
UPDATE "Product" SET "affiliateDisclosure" = replace("affiliateDisclosure", 'Darza', '{brand}') WHERE "affiliateDisclosure" LIKE '%Darza%';
UPDATE "HomeWidget" SET "config" = replace("config"::text, 'Darza', '{brand}')::jsonb WHERE "config"::text LIKE '%Darza%';
UPDATE "Banner" SET
  "title" = replace("title", 'Darza', '{brand}'),
  "subtitle" = replace("subtitle", 'Darza', '{brand}'),
  "ctaLabel" = replace("ctaLabel", 'Darza', '{brand}'),
  "sponsorName" = replace("sponsorName", 'Darza', '{brand}');
