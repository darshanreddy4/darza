import { getSite } from "@/lib/site-profile";

// Business details shown on legal and contact pages. Set these in apps/web/.env.local before launch.
export const business = {
  name: process.env.NEXT_PUBLIC_BUSINESS_NAME || "DMG",
  legalName: process.env.NEXT_PUBLIC_LEGAL_NAME || "",
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
  phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || "",
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || "",
  gstin: process.env.NEXT_PUBLIC_GSTIN || "",
  grievanceOfficer: process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER || "",
  grievanceEmail: process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
};

// The env values are the starting point; anything the admin sets under Brand & contact (including the legal details) wins.
export async function getBusiness() {
  const site = await getSite();
  return {
    ...business,
    name: site.brandName || business.name,
    email: site.email || business.email,
    phone: site.phone || business.phone,
    address: site.address || business.address,
    legalName: site.legalName || business.legalName,
    gstin: site.gstin || business.gstin,
    grievanceOfficer: site.grievanceOfficer || business.grievanceOfficer,
    grievanceEmail: site.grievanceEmail || site.email || business.grievanceEmail,
  };
}

export const LEGAL_UPDATED = "13 October 2026";

export const missingBusinessDetails = (b: Pick<typeof business, "legalName" | "email" | "phone" | "address" | "gstin" | "grievanceOfficer">) =>
  (["legalName", "email", "phone", "address", "gstin", "grievanceOfficer"] as const).filter((k) => !b[k]);
