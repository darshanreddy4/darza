import { useAdminQuery, type AdminProduct } from "@/lib/admin";

// Used until the store setting has loaded.
export const LOW_STOCK = 5;

// The "low stock" level chosen in Settings.
export function useLowStockThreshold(): number {
  const settings = useAdminQuery<{ lowStockThreshold: number }>("/admin/settings");
  return settings.data?.lowStockThreshold ?? LOW_STOCK;
}

export interface AttentionGroup {
  id: "stock" | "drafts" | "images";
  label: string;
  help: string;
  tone: "red" | "amber";
  products: AdminProduct[];
}

// Shared by the overview card and the full review page so their counts always match.
export function attentionGroups(list: AdminProduct[], threshold = LOW_STOCK): AttentionGroup[] {
  return [
    {
      id: "stock", label: "Low or out of stock", tone: "red",
      help: `Our own products with ${threshold} or fewer in stock. Customers can't buy them at 0.`,
      products: list.filter((p) => p.productType === "OWN" && (p.stock ?? 0) <= threshold).sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0)),
    },
    {
      id: "drafts", label: "Drafts not published", tone: "amber",
      help: "Saved but hidden from the store. Open one and tick Published to make it live.",
      products: list.filter((p) => p.status === "DRAFT"),
    },
    {
      id: "images", label: "Products without images", tone: "amber",
      help: "Shown with a letter placeholder. Add at least one image so customers can see the product.",
      products: list.filter((p) => p.images.length === 0),
    },
  ];
}
