import { MessageCircle } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';

function formatEgyptWhatsApp(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) return `2${digits}`;
  if (digits.startsWith('20')) return digits;
  return digits || '201130868723';
}

export function WhatsAppButton() {
  const { data } = usePlatform();
  const rawNumber = data?.settings?.whatsapp_number || '01130868723';
  const waNumber = formatEgyptWhatsApp(rawNumber);
  const platformName = data?.settings?.platform_name || 'ZAZA XPRAS';
  const href = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    `Hello ${platformName} team, I have a question regarding courses and subscriptions.`,
  )}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat on WhatsApp (${rawNumber})`}
      className="fixed bottom-5 right-5 z-40 inline-flex h-12 items-center gap-2.5 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white shadow-lg transition-transform duration-150 hover:scale-[1.03] hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
    >
      <MessageCircle className="h-5 w-5 shrink-0" />
      <span className="hidden sm:inline whitespace-nowrap">WhatsApp</span>
    </a>
  );
}
