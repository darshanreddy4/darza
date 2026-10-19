"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOGO_DESIGN, type LogoDesign } from "@/lib/logo";

interface Brand { name: string; logoUrl: string; logoOnBadge: boolean; logoDesign: LogoDesign }

const BrandContext = createContext<Brand>({ name: "DMG", logoUrl: "", logoOnBadge: false, logoDesign: DEFAULT_LOGO_DESIGN });

// Gives client components the brand name and logo that were read on the server.
export function BrandProvider({ name, logoUrl, logoOnBadge, logoDesign, children }: Brand & { children: ReactNode }) {
  return <BrandContext.Provider value={{ name, logoUrl, logoOnBadge, logoDesign }}>{children}</BrandContext.Provider>;
}

export const useBrandProfile = () => useContext(BrandContext);
export const useBrand = () => useContext(BrandContext).name;
