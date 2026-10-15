"use client";

import { createContext, useContext, type ReactNode } from "react";

interface Brand { name: string; logoUrl: string; logoOnBadge: boolean }

const BrandContext = createContext<Brand>({ name: "DMG", logoUrl: "", logoOnBadge: false });

// Gives client components the brand name and logo that were read on the server.
export function BrandProvider({ name, logoUrl, logoOnBadge, children }: Brand & { children: ReactNode }) {
  return <BrandContext.Provider value={{ name, logoUrl, logoOnBadge }}>{children}</BrandContext.Provider>;
}

export const useBrandProfile = () => useContext(BrandContext);
export const useBrand = () => useContext(BrandContext).name;
