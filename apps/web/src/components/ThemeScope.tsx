import { getAppearance, themeAttr } from "@/lib/appearance";

// Wraps the shop (not the admin console) in the look the admin chose. The original look has no attribute, so nothing changes.
export async function ThemeScope({ children }: { children: React.ReactNode }) {
  const { theme } = await getAppearance();
  return <div data-theme={themeAttr(theme)} className="flex flex-1 flex-col">{children}</div>;
}
