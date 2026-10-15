import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { assertAdminPassword } from "../config/config-check";

// Creates the first admin (or resets that address to admin) without adding any sample products:
// ADMIN_EMAIL=you@shop.com ADMIN_PASSWORD='a long password' node dist/scripts/create-admin.js
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
  assertAdminPassword(password);
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { email },
      update: { role: "ADMIN", passwordHash, passwordSet: true, failedLogins: 0, lockedUntil: null, tokenVersion: { increment: 1 } },
      create: { email, name: "Admin", role: "ADMIN", emailVerifiedAt: new Date(), passwordHash },
    });
    console.log(`Admin account ready: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
