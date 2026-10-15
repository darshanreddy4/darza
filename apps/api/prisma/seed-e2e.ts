import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

// Fixed data for the end-to-end tests (see /e2e). Run it only against a throwaway database:
//   DATABASE_URL=postgresql://.../dmg_e2e npm run db:seed:e2e
const prisma = new PrismaClient();

const E2E_PASSWORD = "E2e-Pass-12345";

async function user(email: string, name: string, role: "ADMIN" | "CUSTOMER") {
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email },
    update: { role, passwordHash, emailVerifiedAt: new Date() },
    create: { email, name, role, passwordHash, emailVerifiedAt: new Date() },
  });
}

async function main() {
  await user("e2e-admin@dmg.test", "E2E Admin", "ADMIN");
  await user("e2e-customer@dmg.test", "E2E Customer", "CUSTOMER");

  const electronics = await prisma.category.upsert({ where: { slug: "electronics" }, update: {}, create: { name: "Electronics", slug: "electronics" } });
  const home = await prisma.category.upsert({ where: { slug: "home-living" }, update: {}, create: { name: "Home & Living", slug: "home-living" } });

  const own = (slug: string, name: string, pricePaise: number, stock: number, categoryId: string, extra: Record<string, unknown> = {}) =>
    prisma.product.upsert({
      where: { slug },
      update: { name, pricePaise, stock, status: "PUBLISHED" },
      create: {
        name, slug, description: `${name}. Sold and shipped by DMG.`, brand: "Voltix", categoryId, productType: "OWN", status: "PUBLISHED",
        pricePaise, stock, sku: slug.toUpperCase(), deliveryInfo: "Delivered in 3-5 business days.", returnPolicy: "7-day replacement for defects.",
        images: { create: [{ url: `https://picsum.photos/seed/${slug}/800/800`, alt: name, position: 0 }] },
        ...extra,
      },
    });

  await own("e2e-usb-cable", "E2E USB-C Cable", 29900, 5, electronics.id, { mrpPaise: 39900, highlights: ["Braided nylon", "1 metre long"] });
  await own("e2e-power-bank", "E2E Power Bank 10000mAh", 149900, 10, electronics.id, { featured: true });
  await own("e2e-sold-out-lamp", "E2E Sold Out Lamp", 79900, 0, home.id);

  await prisma.product.upsert({
    where: { slug: "e2e-partner-speaker" },
    update: {},
    create: {
      name: "E2E Partner Speaker", slug: "e2e-partner-speaker", description: "Portable speaker featured from a partner marketplace.", brand: "Boomio",
      categoryId: home.id, productType: "AFFILIATE", status: "PUBLISHED", pricePaise: 249900, sellerName: "Amazon", platform: "Amazon",
      affiliateUrl: "https://www.amazon.in/", affiliateDisclosure: "Affiliate link. DMG may earn a commission.",
      images: { create: [{ url: "https://picsum.photos/seed/e2e-speaker/800/800", alt: "Speaker", position: 0 }] },
    },
  });

  await prisma.coupon.upsert({
    where: { code: "E2E50" },
    update: { active: true },
    create: { code: "E2E50", description: "End-to-end test coupon", type: "FLAT", value: 5000, minOrderPaise: 0 },
  });
}

main().finally(() => prisma.$disconnect());
