import Link from "next/link";

export function Hero({ brand }: { brand: string }) {
  return (
    <section className="grid gap-4 lg:grid-cols-3 lg:grid-rows-2">
      <div data-chrome="panel" className="relative overflow-hidden rounded-3xl bg-ink p-8 text-white sm:p-12 lg:col-span-2 lg:row-span-2">
        <div className="grid-pattern absolute inset-0" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute -bottom-32 right-20 h-80 w-80 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/15">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Curated · Transparent · Hybrid shopping
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] sm:text-5xl xl:text-6xl">
            Discover products.
            <span className="block bg-linear-to-r from-brand-500 to-gold bg-clip-text text-transparent">Choose where to buy.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">
            Shop {brand} products directly, or explore hand-picked deals and complete the purchase on trusted partner marketplaces — always clearly labelled.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/products" className="rounded-xl bg-brand-500 px-6 py-3 font-semibold text-ink hover:bg-brand-600">Shop all products</Link>
            <Link href="/products?type=AFFILIATE" className="rounded-xl bg-white/10 px-6 py-3 font-semibold ring-1 ring-white/20 hover:bg-white/15">Browse partner deals</Link>
          </div>
        </div>
      </div>

      <Link href="/products?type=OWN" className="group relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-600 to-brand-800 p-7 text-white shadow-card transition hover:shadow-lift">
        <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/10 transition group-hover:scale-125" />
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-200">Sold by {brand}</p>
        <h2 className="mt-2 text-2xl font-bold">Add to cart. We handle the rest.</h2>
        <p className="mt-2 text-sm text-white/75">Direct checkout, delivery and support.</p>
        <span className="relative mt-4 inline-block text-sm font-semibold">Shop {brand} →</span>
      </Link>

      <Link href="/products?type=AFFILIATE" className="group relative overflow-hidden rounded-3xl bg-linear-to-br from-gold to-amber-500 p-7 text-ink shadow-card transition hover:shadow-lift">
        <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/25 transition group-hover:scale-125" />
        <p className="text-xs font-semibold uppercase tracking-widest text-ink/60">Partner picks</p>
        <h2 className="mt-2 text-2xl font-bold">The best deals, one click away.</h2>
        <p className="mt-2 text-sm text-ink/70">Finish your purchase on the partner site.</p>
        <span className="relative mt-4 inline-block text-sm font-semibold">View deals ↗</span>
      </Link>
    </section>
  );
}

export function HowItWorks({ brand }: { brand: string }) {
  return (
    <section data-chrome="panel" className="rounded-3xl bg-ink p-8 text-white sm:p-12">
      <h2 className="text-3xl font-bold">Two ways to shop, one clear experience</h2>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Step tone="brand" title={`Buying from ${brand}`} steps={[`Pick a ${brand} product`, "Add it to your cart", "Check out with us — we ship and support you"]} />
        <Step tone="gold" title="Buying from a partner" steps={["Pick a partner pick", "Click “Buy on” the marketplace", "Complete payment, delivery and returns there"]} />
      </div>
    </section>
  );
}

function Step({ tone, title, steps }: { tone: "brand" | "gold"; title: string; steps: string[] }) {
  const dot = tone === "brand" ? "bg-brand-500" : "bg-gold";
  return (
    <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
      <h3 className="text-lg font-semibold">{title}</h3>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3 text-sm text-white/80">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-ink ${dot}`}>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}
