export interface ParentCheck {
  id?: string;
  parentId?: string | null;
  parent?: { id: string; parentId: string | null } | null;
  childCount?: number;
}

// Categories are two levels deep: a main category and its subcategories. Returns an error message, or null if valid.
export function validateCategoryParent({ id, parentId, parent, childCount = 0 }: ParentCheck): string | null {
  if (!parentId) return null;
  if (id && parentId === id) return "A category cannot be its own parent";
  if (!parent) return "Parent category not found";
  if (parent.parentId) return "Subcategories can only be one level deep. Choose a main category as the parent";
  if (childCount > 0) return "This category has subcategories, so it cannot become a subcategory itself";
  return null;
}
