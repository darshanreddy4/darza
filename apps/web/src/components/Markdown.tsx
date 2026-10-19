import Link from "next/link";
import type { ReactNode } from "react";

// The simple formatting the admin can use in page text: "## Heading", "- bullet", "1. number", **bold**, *italic*,
// [link text](https://...), and a line of "---". Everything else is shown exactly as typed, so pasted HTML is just text.

export type Block =
  | { type: "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "hr" };

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  const flush = () => {
    if (para.length) blocks.push({ type: "p", text: para.join("\n") });
    if (list) blocks.push(list);
    para = []; list = null;
  };
  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if (!line.trim()) flush();
    else if ((m = line.match(/^##\s+(.*)$/))) { flush(); blocks.push({ type: "h2", text: m[1].trim() }); }
    else if ((m = line.match(/^###\s+(.*)$/))) { flush(); blocks.push({ type: "h3", text: m[1].trim() }); }
    else if (/^-{3,}$/.test(line.trim())) { flush(); blocks.push({ type: "hr" }); }
    else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      if (list?.type !== "ul") { flush(); list = { type: "ul", items: [] }; }
      list.items.push(m[1]);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (list?.type !== "ol") { flush(); list = { type: "ol", items: [] }; }
      list.items.push(m[1]);
    } else {
      if (list) flush();
      para.push(line.trim());
    }
  }
  flush();
  return blocks;
}

// Only web links, mail, phone and addresses on this site are links; anything else (javascript:, data:) stays plain text.
export const safeHref = (url: string) => (/^(https?:\/\/|mailto:|tel:)/i.test(url) || /^\/(?!\/)/.test(url) ? url : null);

const TOKEN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^)\s]+\))/g;

export function Inline({ text }: { text: string }): ReactNode {
  return text.split(TOKEN).map((part, i) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const href = safeHref(link[2]);
      if (!href) return <span key={i}>{link[1]}</span>;
      const cls = "text-brand-700 underline";
      return href.startsWith("/") ? <Link key={i} href={href} className={cls}>{link[1]}</Link> : <a key={i} href={href} className={cls} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{link[1]}</a>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "h2": return <h2 className="text-xl font-bold">{block.text}</h2>;
    case "h3": return <h3 className="text-lg font-semibold">{block.text}</h3>;
    case "hr": return <hr className="border-line" />;
    case "ul": return <ul className="list-disc space-y-1.5 pl-5">{block.items.map((t, i) => <li key={i}><Inline text={t} /></li>)}</ul>;
    case "ol": return <ol className="list-decimal space-y-1.5 pl-5">{block.items.map((t, i) => <li key={i}><Inline text={t} /></li>)}</ol>;
    default: return <p className="whitespace-pre-line"><Inline text={block.text} /></p>;
  }
}

// The words in { } are replaced with the store's own details, so the same text works for any brand.
export function fillPlaceholders(text: string, values: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in values ? values[key] : whole));
}

// The page text as the shop shows it: lead-in paragraphs, then each "##" heading with what follows it as a section.
export function RichText({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  const first = blocks.findIndex((b) => b.type === "h2");
  const intro = first === -1 ? blocks : blocks.slice(0, first);
  const rest = first === -1 ? [] : blocks.slice(first);
  const sections: { title: string; blocks: Block[] }[] = [];
  for (const b of rest) {
    if (b.type === "h2") sections.push({ title: b.text, blocks: [] });
    else sections[sections.length - 1].blocks.push(b);
  }
  return (
    <>
      {intro.length > 0 && <div className="mt-6 space-y-3 leading-relaxed text-ink-3">{intro.map((b, i) => <BlockView key={i} block={b} />)}</div>}
      <div className="mt-8 space-y-8">
        {sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-xl font-bold">{s.title}</h2>
            <div className="mt-3 space-y-3 leading-relaxed text-ink-3">{s.blocks.map((b, j) => <BlockView key={j} block={b} />)}</div>
          </section>
        ))}
      </div>
    </>
  );
}

// A short piece of formatted text without headings (the footer note).
export function InlineRichText({ source, className = "" }: { source: string; className?: string }) {
  return <div className={`space-y-2 ${className}`}>{parseBlocks(source).map((b, i) => <BlockView key={i} block={b.type === "h2" || b.type === "h3" ? { type: "p", text: b.text } : b} />)}</div>;
}
