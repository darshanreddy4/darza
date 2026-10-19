-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "currencyCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "currencyDefault" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "currencyRates" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "currencyRatesAt" TIMESTAMP(3),
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'DEFAULT';

