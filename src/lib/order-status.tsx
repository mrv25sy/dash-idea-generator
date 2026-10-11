export const ORDER_STATUSES = ["Pending", "Confirmed", "Processing", "Shipped", "Completed", "Declined", "Canceled"];
export const STATUS_STYLE: Record<string, { cls: string; icon: string }> = {
  Pending: { cls: "bg-yellow-400 text-black", icon: "●" },
  Confirmed: { cls: "bg-neutral-500 text-white", icon: "●" },
  Processing: { cls: "bg-blue-500 text-white", icon: "⟳" },
  Shipped: { cls: "bg-green-600 text-white", icon: "🚚" },
  Completed: { cls: "bg-green-600 text-white", icon: "✓" },
  Declined: { cls: "bg-red-600 text-white", icon: "✕" },
  Archived: { cls: "bg-neutral-800 text-white", icon: "▣" },
  Canceled: { cls: "bg-red-600 text-white", icon: "✕" },
};
export const normStatus = (s: string) => { const n = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); return n === "Delivered" ? "Completed" : n; };
export function StatusBadge({ s }: { s: string }) {
  const st = STATUS_STYLE[s] ?? STATUS_STYLE["Pending"]!;
  return <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${st.cls}`}>{st.icon} {s}</span>;
}
