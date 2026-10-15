import type { ReactNode } from "react";

export const btn = {
  primary: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50",
  dark: "inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-3 disabled:cursor-not-allowed disabled:opacity-50",
  secondary: "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium transition hover:border-ink/40 hover:bg-canvas disabled:opacity-50",
  danger: "inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50",
};

export const inputCls = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none transition placeholder:text-muted/60 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, description, actions, children, className = "", padded = true }: {
  title?: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-white shadow-card ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, tone = "ink" }: { label: string; value: ReactNode; hint?: string; tone?: "ink" | "brand" | "gold" | "red" }) {
  const bar = { ink: "bg-ink", brand: "bg-brand-500", gold: "bg-gold", red: "bg-red-500" }[tone];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-card">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const badgeTones = {
  green: "bg-brand-50 text-brand-800 ring-brand-200",
  amber: "bg-gold-50 text-amber-800 ring-gold/50",
  slate: "bg-canvas text-ink-3 ring-line",
  red: "bg-red-50 text-red-700 ring-red-200",
};
export function Badge({ tone = "slate", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${badgeTones[tone]}`}>{children}</span>;
}

export function Alert({ tone, children, onClose }: { tone: "error" | "success"; children: ReactNode; onClose?: () => void }) {
  const cls = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-brand-200 bg-brand-50 text-brand-800";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`mb-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${cls}`}>
      <span>{children}</span>
      {onClose && <button onClick={onClose} aria-label="Dismiss" className="opacity-60 hover:opacity-100">✕</button>}
    </div>
  );
}

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-5" aria-busy>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-10 rounded-lg bg-canvas" />)}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export const th = "px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted";
export const td = "px-5 py-3.5 align-middle";
