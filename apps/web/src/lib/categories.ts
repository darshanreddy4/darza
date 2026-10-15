export interface TreeNode { id: string; parentId: string | null; name: string; slug: string }
export type WithChildren<T> = T & { children: T[] };

// Two-level tree: main categories with their subcategories, both sorted by name.
export function buildCategoryTree<T extends TreeNode>(items: T[]): WithChildren<T>[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const ids = new Set(items.map((c) => c.id));
  return items
    .filter((c) => !c.parentId || !ids.has(c.parentId))
    .sort(byName)
    .map((parent) => ({ ...parent, children: items.filter((c) => c.parentId === parent.id).sort(byName) }));
}

// Flat, ordered options for selects: "Electronics", then "Electronics › TV".
export function categoryOptions<T extends TreeNode>(items: T[]): { id: string; label: string; depth: 0 | 1 }[] {
  return buildCategoryTree(items).flatMap((p) => [
    { id: p.id, label: p.name, depth: 0 as const },
    ...p.children.map((c) => ({ id: c.id, label: `${p.name} › ${c.name}`, depth: 1 as const })),
  ]);
}
