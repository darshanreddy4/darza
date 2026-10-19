import Link from "next/link";
import { imgSized, type ProductVariant } from "@/lib/api";
import { packLabel } from "@/lib/packSize";

const optionLabel = "text-sm font-semibold";

// Colour and size options built from products in the same group. Each option is the other product's own page.
export function VariantOptions({ variants, currentSlug }: { variants: ProductVariant[]; currentSlug: string }) {
  const current = variants.find((v) => v.slug === currentSlug);
  if (!current || variants.length < 2) return null;

  const colours = [...new Set(variants.map((v) => v.colorName).filter((c): c is string => !!c))];
  // Choosing a colour keeps the current size when that colour comes in it.
  const toColour = (c: string) => variants.find((v) => v.colorName === c && v.packSize === current.packSize) ?? variants.find((v) => v.colorName === c)!;
  const sizes = variants.filter((v) => v.colorName === current.colorName && !!v.packSize);

  return (
    <div className="space-y-4">
      {colours.length > 1 && (
        <div>
          <p className={optionLabel}>Colour: <span className="font-normal text-ink-3">{current.colorName}</span></p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {colours.map((c) => {
              const target = toColour(c);
              const selected = c === current.colorName;
              return (
                <li key={c}>
                  <Link href={`/products/${target.slug}`} aria-current={selected ? "true" : undefined} aria-label={`Colour ${c}${selected ? ", selected" : ""}`} title={c}
                    className={`block h-16 w-16 overflow-hidden rounded-xl border-2 bg-canvas transition ${selected ? "border-ink" : "border-line hover:border-ink/40"}`}>
                    {target.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={imgSized(target.image, 160)} alt="" className="h-full w-full object-cover" />
                      : <span className="grid h-full w-full place-items-center px-1 text-center text-[11px] font-semibold">{c}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {sizes.length > 1 && (
        <div>
          <p className={optionLabel}>{packLabel(current.packSize)}: <span className="font-normal text-ink-3">{current.packSize}</span></p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {sizes.map((v) => {
              const selected = v.slug === currentSlug;
              const sold = v.inStock === false;
              return (
                <li key={v.slug}>
                  <Link href={`/products/${v.slug}`} aria-current={selected ? "true" : undefined}
                    className={`inline-flex min-w-16 items-center justify-center rounded-xl border-2 px-3.5 py-2 text-sm font-semibold transition ${selected ? "border-ink bg-ink text-white" : sold ? "border-dashed border-line text-muted line-through hover:border-ink/40" : "border-line hover:border-ink/40"}`}>
                    {v.packSize}{sold && <span className="sr-only"> (sold out)</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
