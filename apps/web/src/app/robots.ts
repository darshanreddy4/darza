import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site-profile";

// Pages that belong to one shopper or to the team, never to a search result.
const PRIVATE = ["/admin", "/account", "/cart", "/checkout", "/orders", "/wishlist", "/invoice", "/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];

export default async function robots(): Promise<MetadataRoute.Robots> {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE }],
    sitemap: absoluteUrl(await getSiteUrl(), "/sitemap.xml"),
  };
}
