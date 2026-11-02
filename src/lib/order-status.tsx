import { Check, CheckCircle2, Circle, Clock, Loader, Archive, Truck, XCircle, type LucideIcon } from "lucide-react";
export const ORDER_STATUSES = ["Pending", "Confirmed", "Processing", "Shipped", "Completed", "Declined", "Canceled"];
export const STATUS_STYLE: Record<string, { cls: string; icon: LucideIcon }> = {
  Pending: { cls: "border-amber-500 text-amber-600", icon: Clock },
  Confirmed: { cls: "border-sky-500 text-sky-600", icon: Check },
  Processing: { cls: "border-blue-500 text-blue-600", icon: Loader },
  Shipped: { cls: "border-emerald-500 text-emerald-600", icon: Truck },
  Completed: { cls: "border-green-500 text-green-600", icon: CheckCircle2 },
  Declined: { cls: "border-red-500 text-red-600", icon: XCircle },
  Archived: { cls: "border-border text-muted-foreground", icon: Archive },
  Canceled: { cls: "border-red-500 text-red-600", icon: XCircle },
};
export const normStatus = (s: string) => { const n = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); return n === "Delivered" ? "Completed" : n; };
export function StatusBadge({ s }: { s: string }) {
  const st = STATUS_STYLE[s] ?? { cls: "border-border text-muted-foreground", icon: Circle };
  const Ic = st.icon;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${st.cls}`}><Ic size={12} strokeWidth={1.75} /> {s}</span>;
}
