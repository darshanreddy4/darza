"use client";

import { Fragment, useRef, useState, type FormEvent } from "react";
import { slugify, useAdminApi, useAdminQuery, type AdminCategory, type AdminProduct } from "@/lib/admin";
import { buildCategoryTree } from "@/lib/categories";
import { Alert, Badge, Card, Empty, PageHeader, Skeleton, btn, inputCls, td, th } from "@/components/admin/ui";

export default function CategoriesAdminPage() {
  const call = useAdminApi();
  const cats = useAdminQuery<AdminCategory[]>("/admin/categories");
  const products = useAdminQuery<AdminProduct[]>("/admin/products");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState("");
  const [touched, setTouched] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const tree = buildCategoryTree(cats.data ?? []);
  const counts = new Map<string, number>();
  (products.data ?? []).forEach((p) => counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1));

  async function act(fn: () => Promise<unknown>, message: string) {
    setError(""); setNotice("");
    try { await fn(); setNotice(message); cats.reload(); products.reload(); return true; } catch (e) { setError((e as Error).message); return false; }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const ok = await act(
      () => call("/admin/categories", { method: "POST", body: JSON.stringify({ name: name.trim(), slug, parentId: parentId || undefined }) }),
      parentId ? "Subcategory created" : "Category created",
    );
    if (ok) { setName(""); setSlug(""); setTouched(false); }
  }

  function addSubcategory(id: string) {
    setParentId(id);
    nameRef.current?.focus();
    nameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const rowProps = (c: AdminCategory, hasChildren: boolean, isChild: boolean) => ({
    c, isChild, hasChildren,
    count: counts.get(c.id) ?? 0,
    mains: tree.filter((p) => p.id !== c.id),
    editing: editing === c.id,
    onEdit: () => setEditing(c.id),
    onCancel: () => setEditing(null),
    onSave: async (v: { name: string; slug: string; parentId: string }) => {
      if (await act(() => call(`/admin/categories/${c.id}`, { method: "PUT", body: JSON.stringify({ name: v.name, slug: v.slug, parentId: v.parentId || null }) }), "Category updated")) setEditing(null);
    },
    onDelete: () => confirm(`Delete \u201c${c.name}\u201d?`) && act(() => call(`/admin/categories/${c.id}`, { method: "DELETE" }), "Category deleted"),
    onAddSub: () => addSubcategory(c.id),
  });

  return (
    <>
      <PageHeader title="Categories" description="Organise products into main categories and subcategories, like Electronics › TV. Empty categories stay hidden on the storefront." />
      {error && <Alert tone="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert tone="success" onClose={() => setNotice("")}>{notice}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card padded={false}>
          {cats.loading ? <Skeleton rows={4} /> : tree.length === 0 ? <Empty title="No categories yet">Create your first main category to start adding products.</Empty> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas/60"><th className={th}>Name</th><th className={th}>Slug</th><th className={th}>Products</th><th className={`${th} text-right`}>Actions</th></tr></thead>
              <tbody className="divide-y divide-line">
                {tree.map((p) => (
                  <Fragment key={p.id}>
                    <CategoryRow {...rowProps(p, p.children.length > 0, false)} />
                    {p.children.map((s) => <CategoryRow key={s.id} {...rowProps(s, false, true)} />)}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title={parentId ? "New subcategory" : "New category"} description="Choose a parent to create a subcategory." className="h-fit">
          <form onSubmit={add} className="space-y-4">
            <label className="block text-sm font-medium">Parent category
              <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={`${inputCls} mt-1.5`}>
                <option value="">None (main category)</option>
                {tree.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Name
              <input ref={nameRef} required value={name} maxLength={80} placeholder={parentId ? "e.g. Washing machines" : "e.g. Electronics"} className={`${inputCls} mt-1.5`} onChange={(e) => { setName(e.target.value); if (!touched) setSlug(slugify(e.target.value)); }} />
            </label>
            <label className="block text-sm font-medium">Slug
              <input required value={slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={`${inputCls} mt-1.5 font-mono`} onChange={(e) => { setSlug(e.target.value); setTouched(true); }} />
            </label>
            <button className={`${btn.primary} w-full`}>{parentId ? "Create subcategory" : "Create category"}</button>
          </form>
        </Card>
      </div>
    </>
  );
}

function CategoryRow({ c, isChild, hasChildren, count, mains, editing, onEdit, onCancel, onSave, onDelete, onAddSub }: {
  c: AdminCategory; isChild: boolean; hasChildren: boolean; count: number; mains: AdminCategory[]; editing: boolean;
  onEdit: () => void; onCancel: () => void; onSave: (v: { name: string; slug: string; parentId: string }) => void; onDelete: () => void; onAddSub: () => void;
}) {
  const [name, setName] = useState(c.name);
  const [slug, setSlug] = useState(c.slug);
  const [parent, setParent] = useState(c.parentId ?? "");
  const blocked = hasChildren ? "Delete its subcategories first" : count > 0 ? "Move or delete its products first" : undefined;

  return (
    <tr className={isChild ? "bg-canvas/30 hover:bg-canvas/60" : "hover:bg-canvas/60"}>
      <td className={td}>
        {editing ? (
          <div className="space-y-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} aria-label="Category name" />
            <select value={parent} onChange={(e) => setParent(e.target.value)} disabled={hasChildren} title={hasChildren ? "A category with subcategories must stay a main category" : undefined} className={inputCls} aria-label="Parent category">
              <option value="">None (main category)</option>
              {mains.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        ) : isChild ? (
          <span className="flex items-center gap-2 pl-6"><span aria-hidden className="text-muted">↳</span>{c.name}</span>
        ) : (
          <span className="flex items-center gap-2 font-semibold">{c.name} {hasChildren && <Badge>Main</Badge>}</span>
        )}
      </td>
      <td className={td}>{editing ? <input value={slug} onChange={(e) => setSlug(e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={`${inputCls} font-mono`} aria-label="Category slug" /> : <span className="font-mono text-xs text-muted">{c.slug}</span>}</td>
      <td className={td}>{count}</td>
      <td className={`${td} text-right`}>
        <div className="flex flex-wrap justify-end gap-2">
          {editing ? (
            <><button className={btn.dark + " !px-3 !py-1.5"} onClick={() => onSave({ name: name.trim(), slug, parentId: parent })}>Save</button><button className={btn.secondary + " !px-3 !py-1.5"} onClick={onCancel}>Cancel</button></>
          ) : (
            <>
              {!isChild && <button className={btn.secondary + " !px-3 !py-1.5"} onClick={onAddSub}>+ Subcategory</button>}
              <button className={btn.secondary + " !px-3 !py-1.5"} onClick={onEdit}>Edit</button>
              <button className={btn.danger + " disabled:cursor-not-allowed disabled:opacity-40"} disabled={!!blocked} title={blocked} onClick={onDelete}>Delete</button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
