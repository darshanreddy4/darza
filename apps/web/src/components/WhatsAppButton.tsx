import { SocialIcon } from "@/components/SocialIcons";

// A round chat button fixed to the corner of every page.
export function WhatsAppButton({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp" title="Chat with us on WhatsApp" className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lift transition hover:scale-105">
      <SocialIcon name="whatsapp" size={28} />
    </a>
  );
}
