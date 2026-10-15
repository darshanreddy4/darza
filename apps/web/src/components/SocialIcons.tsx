// Simple line icons, one per way of reaching the brand.
const PATHS: Record<string, string> = {
  instagram: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM17.5 6.5h.01",
  facebook: "M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z",
  x: "M4 4l16 16M20 4L4 20",
  youtube: "M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM10 9l5 3-5 3z",
  linkedin: "M4 4h4v4H4zM4 10h4v10H4zM10 10h4v2a4 4 0 0 1 6 2v6h-4v-5a2 2 0 0 0-4 0v5h-2z",
  pinterest: "M12 3a9 9 0 0 0-3 17.5c-.1-.8-.1-2 .1-2.9l1.1-4.6s-.3-.6-.3-1.4c0-1.3.8-2.3 1.7-2.3.8 0 1.2.6 1.2 1.300 0 .8-.5 2-.8 3.100-.2.9.5 1.600 1.400 1.600 1.700 0 3-1.800 3-4.300 0-2.300-1.600-3.800-4-3.800-2.700 0-4.300 2-4.300 4.100 0 .8.3 1.700.7 2.100",
  telegram: "M21 4L3 11l6 2 2 6 3-4 5 4zM9 13l8-6",
  threads: "M16.500 9.500C16 6.500 14.200 5 12 5c-3 0-5 2.500-5 7s2 7 5 7c3 0 4.500-1.800 4.500-3.700 0-2.300-2.200-3-4.500-2.800-1.700.1-2.500.9-2.500 1.800 0 1 .9 1.700 2.200 1.600 2.200-.1 3-1.800 2.800-4.400",
  snapchat: "M12 3c3 0 4.500 2 4.500 4.500V10l3 1-2 1.500c.5 1.500 1.500 2.500 2.500 3-1 .8-2 .8-3 1-.5 1-1.500 2-4.500 2s-4-1-4.500-2c-1-.2-2-.2-3-1 1-.5 2-1.500 2.500-3L4.500 11l3-1V7.500C7.500 5 9 3 12 3z",
  whatsapp: "M3 21l1.600-4.700A8.500 8.500 0 1 1 8 19.500zM9 8.500c0 3.500 3 6.500 6.500 6.500l1-1.500-2.200-1-1 .8c-1-.5-1.800-1.300-2.300-2.300l.8-1-1-2.200z",
  email: "M3 5h18v14H3zM3 7l9 6 9-6",
  other: "M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1",
};

export function SocialIcon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name] ?? PATHS.other} />
    </svg>
  );
}
