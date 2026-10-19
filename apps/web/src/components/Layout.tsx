import Link from "next/link";
import { api, type Category } from "@/lib/api";
import { buildCategoryTree } from "@/lib/categories";
import { CartLink } from "./CartLink";
import { AuthNav } from "./AuthNav";
import { WishlistLink } from "./WishlistLink";
import { Logo } from "./Logo";
import { InlineRichText, fillPlaceholders } from "./Markdown";
import { getLegalLinks } from "@/lib/pages";
import { DEFAULT_ANNOUNCEMENT, DEFAULT_TRANSPARENCY } from "@/lib/policy-defaults";
import { SearchBox } from "./SearchBox";
import { CurrencySwitcher } from "./CurrencySwitcher";
import { SocialIcon } from "./SocialIcons";
import { DEFAULT_BRAND, getSite, contactLinks, whatsappUrl } from "@/lib/site-profile";
import { getBusiness } from "@/lib/business";

export async function Header() {
  const [categories, site] = await Promise.all([api<Category[]>("/categories").catch(() => [] as Category[]), getSite()]);
  const brand = site.brandName || DEFAULT_BRAND;
  const tree = buildCategoryTree(categories);

  return (
    <header className="sticky top-0 z-40">
      {site.announcementOn && (
        <div data-chrome="top" className="bg-ink-3 text-center text-xs text-white/80">
          <p className="mx-auto max-w-7xl px-4 py-1.5">{fillPlaceholders(site.announcement || DEFAULT_ANNOUNCEMENT, { brand })}</p>
        </div>
      )}
      <div data-chrome="bar" className="bg-ink">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 sm:gap-x-6 sm:px-6 md:flex-nowrap">
          <Link href="/" aria-label={`${brand} home`}><Logo logoUrl={site.logoUrl} name={brand} onBadge={site.logoOnBadge} design={site.logoDesign} /></Link>

          {/* On a phone the search bar gets its own full-width row under the logo and buttons. */}
          <div className="order-last flex min-w-full md:order-none md:min-w-0 md:flex-1">
          <SearchBox categories={tree.map((p) => ({ id: p.id, name: p.name, slug: p.slug, children: p.children.map((c) => ({ id: c.id, name: c.name, slug: c.slug })) }))} />
          </div>

          <nav className="ml-auto flex items-center gap-1 sm:gap-2 md:ml-0">
            <CurrencySwitcher />
            <WishlistLink />
            <CartLink />
            <AuthNav />
          </nav>
        </div>
      </div>

      <div className="border-b border-line bg-white">
        <nav className="no-scrollbar mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 sm:px-6 lg:flex-wrap lg:overflow-visible" aria-label="Categories">
          <NavLink href="/products">All products</NavLink>
          <NavLink href="/products?type=OWN">Sold by {brand}</NavLink>
          <NavLink href="/products?type=AFFILIATE">Partner deals</NavLink>
          <span className="mx-2 h-4 w-px shrink-0 bg-line" />
          {tree.map((c) => (
            <div key={c.id} className="group relative shrink-0">
              <NavLink href={`/products?category=${c.slug}`}>
                {c.name}
                {c.children.length > 0 && <span aria-hidden className="ml-1 text-[10px] text-muted">▾</span>}
              </NavLink>
              {c.children.length > 0 && (
                <div className="absolute left-0 top-full z-50 hidden w-72 rounded-b-2xl border border-t-0 border-line bg-white p-3 shadow-lift group-focus-within:block lg:group-hover:block">
                  <Link href={`/products?category=${c.slug}`} className="mb-1 block rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                    All {c.name} →
                  </Link>
                  <ul className="grid grid-cols-1 gap-0.5">
                    {c.children.map((s) => (
                      <li key={s.id}>
                        <Link href={`/products?category=${s.slug}`} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-3 hover:bg-canvas hover:text-ink">
                          {s.name} <span className="text-xs text-muted">{s.productCount}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-ink-3 hover:border-brand-500 hover:text-brand-700">
      {children}
    </Link>
  );
}

export async function Footer() {
  const [site, biz, legalLinks] = await Promise.all([getSite(), getBusiness(), getLegalLinks()]);
  const name = biz.name;
  const links = contactLinks(site, biz.email);
  const social = links.filter((l) => l.key !== "email" && l.key !== "whatsapp");
  const careExists = site.careHours || site.careNote || biz.phone || biz.email || site.whatsapp || biz.address;
  const wa = whatsappUrl(site);

  return (
    <footer data-chrome="footer" className="mt-20 bg-ink text-white/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr_1.2fr]">
        <div className="space-y-4">
          <Logo logoUrl={site.logoUrl} name={name} onBadge={site.logoOnBadge} design={site.logoDesign} />
          <p className="max-w-sm text-sm leading-relaxed">
            {site.tagline || `A curated shopping destination. Buy ${name} products directly, or discover selected products and complete the purchase on trusted partner marketplaces.`}
          </p>
          {social.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-white">Connect with us</p>
              <ul className="flex flex-wrap gap-2">
                {social.map((l) => (
                  <li key={`${l.key}-${l.url}`}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer me" aria-label={l.label} title={l.label} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-brand-500 hover:text-ink">
                      <SocialIcon name={l.key} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div>
          <h2 className="mb-4 text-sm font-semibold text-white">Shop</h2>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/products" className="hover:text-white">All products</Link></li>
            <li><Link href="/products?type=OWN" className="hover:text-white">Sold by {name}</Link></li>
            <li><Link href="/products?type=AFFILIATE" className="hover:text-white">Partner deals</Link></li>
            <li><Link href="/cart" className="hover:text-white">Your cart</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-4 text-sm font-semibold text-white">Company</h2>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/about" className="hover:text-white">About us</Link></li>
            {legalLinks.map((l) => <li key={l.href}><Link href={l.href} className="hover:text-white">{l.label}</Link></li>)}
          </ul>
        </div>
        <div>
          <h2 className="mb-4 text-sm font-semibold text-white">Customer care</h2>
          {careExists ? (
            <ul className="space-y-2.5 text-sm">
              {site.careHours && <li>{site.careHours}</li>}
              {biz.phone && <li><a href={`tel:${biz.phone.replace(/[^+\d]/g, "")}`} className="hover:text-white">{biz.phone}</a></li>}
              {biz.email && <li><a href={`mailto:${biz.email}`} className="break-all hover:text-white">{biz.email}</a></li>}
              {wa && <li><a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-white">Chat on WhatsApp</a></li>}
              {biz.address && <li className="leading-relaxed">{biz.address}</li>}
              {site.careNote && <li className="text-xs leading-relaxed text-white/60">{site.careNote}</li>}
            </ul>
          ) : (
            <p className="text-sm"><Link href="/contact" className="hover:text-white">Contact &amp; grievance</Link></p>
          )}
        </div>
        {site.transparencyOn && (
          <div>
            <h2 className="mb-4 text-sm font-semibold text-white">Transparency</h2>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed">
              <InlineRichText source={fillPlaceholders(site.transparencyNote || DEFAULT_TRANSPARENCY, { brand: name })} />
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs sm:px-6">© {new Date().getFullYear()} {name}. All rights reserved.</p>
      </div>
    </footer>
  );
}
