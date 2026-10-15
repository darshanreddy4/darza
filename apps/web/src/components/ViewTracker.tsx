"use client";

import { useEffect } from "react";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const KEY = "dmg-visitor";

function visitorId() {
  let id = localStorage.getItem(KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(KEY, id); }
  return id;
}

// Records one anonymous product view; admins are excluded so their browsing doesn't skew reports.
export function ViewTracker({ slug }: { slug: string }) {
  const { user, ready } = useAuth();
  const isAdmin = !!user && user.role !== "CUSTOMER";

  useEffect(() => {
    if (!ready || isAdmin) return;
    fetch(`${API_URL}/track/view`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, visitorId: visitorId() }), keepalive: true,
    }).catch(() => {});
  }, [slug, ready, isAdmin]);

  return null;
}
