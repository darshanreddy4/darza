import type { Role } from "@prisma/client";

export interface RoleChange {
  actorId: string;
  targetId: string;
  currentRole: Role;
  newRole: Role;
  // Admins that exist right now, including the target if it is one.
  adminCount: number;
}

// Returns why a role change is not allowed, or null when it is fine.
export function validateRoleChange(c: RoleChange): string | null {
  if (c.actorId === c.targetId) return "You cannot change your own role. Ask another admin.";
  if (c.currentRole === c.newRole) return null;
  if (c.currentRole === "ADMIN" && c.newRole !== "ADMIN" && c.adminCount <= 1) return "There must always be at least one admin.";
  return null;
}
