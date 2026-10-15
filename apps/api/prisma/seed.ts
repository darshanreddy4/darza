import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { assertAdminPassword } from "../src/config/config-check";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
  assertAdminPassword(password);
  await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN" },
    create: { email, name: "Admin", role: "ADMIN", emailVerifiedAt: new Date(), passwordHash: await bcrypt.hash(password, 12) },
  });

  const electronics = await prisma.category.upsert({
    where: { slug: "electronics" }, update: {}, create: { name: "Electronics", slug: "electronics" },
  });
  const lifestyle = await prisma.category.upsert({
    where: { slug: "lifestyle" }, update: {}, create: { name: "Lifestyle", slug: "lifestyle" },
  });

  await prisma.product.upsert({
    where: { slug: "dmg-wireless-charger" },
    update: {},
    create: {
      name: "DMG 15W Wireless Charger",
      slug: "dmg-wireless-charger",
      description: "Slim 15W fast wireless charger with anti-slip surface.",
      brand: "DMG",
      categoryId: electronics.id,
      productType: "OWN",
      status: "PUBLISHED",
      featured: true,
      pricePaise: 129900,
      mrpPaise: 199900,
      sku: "DZ-WC-15",
      stock: 25,
      deliveryInfo: "Delivered in 3-5 business days.",
      returnPolicy: "7-day replacement for defects.",
      images: { create: [{ url: "https://picsum.photos/seed/dmg-charger/800/800", alt: "Wireless charger", position: 0 }] },
    },
  });

  await prisma.product.upsert({
    where: { slug: "sample-bluetooth-speaker" },
    update: {},
    create: {
      name: "Sample Bluetooth Speaker",
      slug: "sample-bluetooth-speaker",
      description: "Portable speaker featured from a partner marketplace.",
      brand: "SampleBrand",
      categoryId: lifestyle.id,
      productType: "AFFILIATE",
      status: "PUBLISHED",
      pricePaise: 249900,
      sellerName: "Amazon",
      platform: "Amazon",
      affiliateUrl: "https://www.amazon.in/",
      affiliateDisclosure: "Affiliate link. DMG may earn a commission if you purchase through this link, at no extra cost to you.",
      images: { create: [{ url: "https://picsum.photos/seed/dmg-speaker/800/800", alt: "Bluetooth speaker", position: 0 }] },
    },
  });
}

main().finally(() => prisma.$disconnect());
