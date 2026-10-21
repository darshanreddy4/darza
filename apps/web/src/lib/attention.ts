import { useAdminQuery, type AdminProduct } from "@/lib/admin";

// Used until the store setting has loaded.
export const LOW_STOCK = 5;

// The "low stock" level chosen in Settings; it is part of the public store details so every team role can read it.
export function useLowStockThreshold(): number {
  return useStockSettings().threshold;
}

// The low stock level and whether single options are flagged too (both set in Settings).
export function useStockSettings() {
  const settings = useAdminQuery<{ lowStockThreshold?: number; optionStockAlerts?: boolean }>("/store/config");
  return { threshold: settings.data?.lowStockThreshold ?? LOW_STOCK, optionAlerts: settings.data?.optionStockAlerts ?? false };
}

// The options of a product that are at or under the low stock level.
export const lowOptions = (p: AdminProduct, threshold: number) => (p.productType === "OWN" ? p.options.filter((o) => o.stock <= threshold) : []);

export interface AttentionGroup {
  id: "stock" | "drafts" | "images";
  label: string;
  help: string;
  tone: "red" | "amber";
  products: AdminProduct[];
}

// Shared by the overview card and the full review page so their counts always match.
export function attentionGroups(list: AdminProduct[], threshold = LOW_STOCK, optionAlerts = false): AttentionGroup[] {
  // With option alerts on, a product also counts when one of its options is low even though the total is fine.
  const least = (p: AdminProduct) => Math.min(p.stock ?? 0, ...(optionAlerts ? lowOptions(p, threshold).map((o) => o.stock) : []));
  return [
    {
      id: "stock", label: "Low or out of stock", tone: "red",
      help: optionAlerts
        ? `Our own products, or any one of their options, with ${threshold} or fewer in stock. Customers can't buy them at 0.`
        : `Our own products with ${threshold} or fewer in stock. Customers can't buy them at 0.`,
      products: list.filter((p) => p.productType === "OWN" && ((p.stock ?? 0) <= threshold || (optionAlerts && lowOptions(p, threshold).length > 0))).sort((a, b) => least(a) - least(b)),
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
