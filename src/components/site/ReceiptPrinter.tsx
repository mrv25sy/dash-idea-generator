import { useEffect, useMemo, useRef, useState } from "react";
import { CURRENCY } from "@/config";

export type ReceiptOrder = { id: string; date: string; total: number; items: string[]; name?: string; status?: string };

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }).format(n);

/** Simple deterministic barcode bars from the order code. */
function bars(code: string) {
  const out: number[] = [];
  for (let i = 0; i < 46; i++) out.push(1 + ((code.charCodeAt(i % code.length) * (i + 7)) % 3));
  return out;
}

export function ReceiptPrinter({ order, onClose }: { order: ReceiptOrder; onClose: () => void }) {
  const [phase, setPhase] = useState<"printing" | "ready" | "torn">("printing");
  const paperRef = useRef<HTMLDivElement>(null);
  const b = useMemo(() => bars(order.id), [order.id]);
  const d = new Date(order.date);

  useEffect(() => {
    const t = setTimeout(() => setPhase("ready"), 2600);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => { clearTimeout(t); window.removeEventListener("keydown", esc); };
  }, [onClose]);

  const download = () => {
    const W = 600, lineH = 34;
    const H = 520 + order.items.length * lineH;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = "#fbfaf6"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#111"; g.textAlign = "center";
    g.font = "900 56px Georgia, serif"; g.fillText("VICE", W / 2, 80);
    g.font = "16px monospace"; g.fillText("ORDER RECEIPT", W / 2, 112);
    g.fillText(`${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`, W / 2, 140);
    g.textAlign = "left"; g.font = "bold 22px monospace";
    g.fillText(`ORDER ${order.id}`, 40, 200);
    g.font = "18px monospace";
    if (order.name) g.fillText(`FOR ${order.name.toUpperCase()}`, 40, 232);
    let y = 290;
    order.items.forEach((it) => { g.fillText(it.slice(0, 44), 40, y); y += lineH; });
    g.fillText("- ".repeat(26), 40, y); y += 44;
    g.font = "bold 28px monospace"; g.fillText("TOTAL", 40, y);
    g.textAlign = "right"; g.fillText(money(order.total), W - 40, y);
    g.textAlign = "left"; y += 40;
    g.font = "16px monospace"; g.fillText(`STATUS: ${(order.status ?? "Pending").toUpperCase()}`, 40, y); y += 30;
    let x = 60;
    b.forEach((w, i) => { if (i % 2 === 0) g.fillRect(x, y, w * 3, 70); x += w * 3 + 2; });
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `vice-receipt-${order.id.replace("#", "")}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-background/85 px-4 pb-10 pt-10 backdrop-blur-md" onClick={onClose}>
      <div className="relative w-full max-w-[340px]" onClick={(e) => e.stopPropagation()}>
        {/* Printer slot */}
        <div className={`printer-slot ${phase === "printing" ? "is-busy" : ""} relative z-20 mx-auto flex h-16 items-center justify-between rounded-2xl px-5`}>
          <span className="font-display text-xs font-black uppercase tracking-[.3em]">Vice</span>
          <span className={`printer-led ${phase === "printing" ? "is-busy" : "is-ready"}`} aria-label={phase === "printing" ? "Printing" : "Ready"} />
          <span className="printer-mouth" />
        </div>

        {/* Paper */}
        <div className="relative -mt-3 overflow-hidden px-3">
          <div
            ref={paperRef}
            onClick={() => phase === "ready" && setPhase("torn")}
            className={`receipt-paper ${phase === "printing" ? "is-printing" : ""} ${phase === "torn" ? "is-torn" : ""} ${phase === "ready" ? "cursor-pointer" : ""}`}
          >
            <div className="px-5 pb-4 pt-8 font-mono text-[12px] leading-relaxed">
              <p className="text-center font-display text-3xl font-black tracking-tight">VICE</p>
              <p className="text-center text-[10px] tracking-[.3em]">ORDER RECEIPT</p>
              <p className="mt-1 text-center text-[10px] opacity-70">{d.toLocaleDateString()} · {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              <div className="receipt-rule" />
              <div className="flex justify-between font-bold"><span>ORDER</span><span>{order.id}</span></div>
              {order.name && <div className="flex justify-between"><span>FOR</span><span className="truncate pl-4 uppercase">{order.name}</span></div>}
              <div className="receipt-rule" />
              <ul className="space-y-1">
                {order.items.map((it, i) => <li key={i} className="break-words">{it}</li>)}
              </ul>
              <div className="receipt-rule" />
              <div className="flex items-baseline justify-between text-base font-bold"><span>TOTAL</span><span>{money(order.total)}</span></div>
              <p className="mt-1 text-[10px] uppercase tracking-widest opacity-70">Paid online · receipt attached</p>
              <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[.3em]">● {order.status ?? "Pending"} ●</p>
              <div className="mt-4 flex h-12 items-stretch justify-center gap-[2px]" aria-hidden>
                {b.map((w, i) => <span key={i} className={i % 2 ? "" : "receipt-bar"} style={{ width: w * 1.5 }} />)}
              </div>
              <p className="mt-1 text-center text-[10px] tracking-[.4em]">{order.id.replace("#", "")}</p>
            </div>
            <div className="receipt-teeth" />
          </div>
        </div>

        {phase === "ready" && (
          <>
            <div className="sparkle-layer" aria-hidden>
              {(["l", "r"] as const).flatMap((side) => Array.from({ length: 18 }).map((_, i) => {
                const ang = (-70 + i * 7) * (Math.PI / 180);
                const dist = 160 + ((i * 53) % 220);
                const dx = Math.cos(ang) * dist * (side === "l" ? 1 : -1);
                const dy = Math.sin(ang) * dist;
                return <span key={side + i} className={`spk s${i % 3}`} style={{ [side === "l" ? "left" : "right"]: "0px", "--tx": `${dx}px`, "--ty": `${dy}px`, "--d": `${(i % 6) * 60}ms`, "--sz": `${10 + ((i * 7) % 14)}px` } as React.CSSProperties} />;
              }))}
            </div>
            <p className="receipt-fade mt-4 text-center text-xs font-semibold uppercase tracking-[.25em] text-muted-foreground">Tap receipt to tear off</p>
          </>
        )}

        {phase !== "printing" && (
          <div className="receipt-fade mt-5 grid grid-cols-2 gap-3" style={{ animationDelay: "150ms" }}>
            <button onClick={download} className="receipt-btn receipt-btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12m0 0-5-5m5 5 5-5M5 21h14" /></svg>
              Download
            </button>
            <button onClick={onClose} className="receipt-btn receipt-btn-ghost">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5 9-10" /></svg>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
