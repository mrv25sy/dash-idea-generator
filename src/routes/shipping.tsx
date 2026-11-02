import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, MessageCircle, Instagram, Phone } from "lucide-react";
import { INSTAGRAM_URL, PHONE_NUMBER } from "@/config";
import { FAQ } from "@/data/faq";

const title = "Shipping & FAQ — Vice";
const description = "Answers about Vice shipping, delivery times, payment and orders across Syria.";

export const Route = createFileRoute("/shipping")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShippingPage,
});

function ShippingPage() {
  const [open, setOpen] = useState<number | null>(0);
  const digits = PHONE_NUMBER.replace(/\D/g, "");
  const contacts = [
    { icon: MessageCircle, label: "WhatsApp", sub: "Fastest reply", href: `https://wa.me/${digits}?text=${encodeURIComponent("Hi Vice! I have a question")}` },
    { icon: Instagram, label: "Instagram", sub: "DM us anytime", href: INSTAGRAM_URL },
    { icon: Phone, label: "Call us", sub: PHONE_NUMBER, href: `tel:${PHONE_NUMBER}` },
  ];
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12 md:py-20">
      <p className="nav-link text-muted-foreground">Help</p>
      <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-wider md:text-5xl">Shipping & FAQ</h1>
      <p className="mt-3 text-sm text-muted-foreground">Tap a question to see the answer.</p>

      <ul className="mt-10 divide-y divide-border border-y border-border">
        {FAQ.map((f, i) => {
          const isOpen = open === i;
          return (
            <li key={f.q}>
              <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 py-5 text-left">
                <span className="text-base font-semibold">{f.q}</span>
                <ChevronDown className={`h-5 w-5 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr] pb-5 opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <p className="overflow-hidden text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold uppercase tracking-wider">Still have questions?</h2>
        <p className="mt-2 text-sm text-muted-foreground">Reach out — we usually answer within a few hours.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {contacts.map(({ icon: Icon, label, sub, href }) => (
            <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted">
              <Icon className="h-5 w-5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block truncate text-xs text-muted-foreground">{sub}</span>
              </span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
