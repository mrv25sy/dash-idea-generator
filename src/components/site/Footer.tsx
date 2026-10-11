import { useState } from "react";
import { INSTAGRAM_URL, PHONE_NUMBER, WHATSAPP_CHANNEL_URL } from "@/config";
import { Logo } from "./Logo";

const WHATSAPP_CHAT = `https://wa.me/${PHONE_NUMBER.replace(/\D/g, "")}?text=${encodeURIComponent("Hi Vice!")}`;

export function Footer() {
  const [shipOpen, setShipOpen] = useState(false);
  return (
    <footer className="relative overflow-hidden border-t border-border pt-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 md:flex-row md:items-center md:justify-between md:px-8">
        <Logo className="h-10 w-10" />
        <div className="flex gap-8">
          <button onClick={() => setShipOpen((o) => !o)} aria-expanded={shipOpen} className="nav-link">Shipping</button>
          <a href={WHATSAPP_CHAT} target="_blank" rel="noopener noreferrer" className="nav-link">Customer Support</a>
        </div>
        <div className="flex gap-3">
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" aria-label="Instagram" className="icon-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" /></svg>
          </a>
          <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noreferrer" aria-label="WhatsApp channel" className="icon-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" /></svg>
          </a>
        </div>
      </div>
      {shipOpen && (
        <section id="shipping" className="mx-auto mt-8 max-w-7xl px-5 md:px-8">
          <div className="border border-border p-5 text-sm">
            <h3 className="font-display text-lg font-semibold uppercase tracking-wider">Shipping guide</h3>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>• We ship to all Syrian governorates.</li>
              <li>• Orders are prepared within 1–2 days after confirmation.</li>
              <li>• Delivery usually takes 2–5 days depending on your city.</li>
              <li>• Shipping cost is confirmed with you on WhatsApp before sending.</li>
            </ul>
          </div>
        </section>
      )}
      <p className="mx-auto mt-8 max-w-7xl px-5 text-[11px] uppercase tracking-[0.3em] text-muted-foreground md:px-8">© {new Date().getFullYear()} Vice. Street calls, we answer.</p>
      <div aria-hidden className="wordmark">VICE</div>
    </footer>
  );
}
