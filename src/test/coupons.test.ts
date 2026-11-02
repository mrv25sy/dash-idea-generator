import { describe, expect, it } from "vitest";
import { applyCoupon, packTag, unpackTag, type Coupon } from "@/lib/coupons";

const now = new Date("2026-10-18T12:00:00Z");
const base: Coupon = { code: "VIP20", type: "percent", value: 20, active: true };
const lines = [{ category: "tee", qty: 1, total: 100 }, { category: "hoodie", qty: 1, total: 200 }];
const ctx = { now, lines, customerId: 12345, usedCodes: [] as string[] };

describe("coupons", () => {
  it("percent off", () => expect(applyCoupon(base, ctx).discount).toBe(60));
  it("not started", () => expect(applyCoupon({ ...base, startsAt: "2026-10-19T00:00:00Z" }, ctx).error).toBeTruthy());
  it("expired", () => expect(applyCoupon({ ...base, endsAt: "2026-10-17T00:00:00Z" }, ctx).error).toBeTruthy());
  it("needs 2 or more items", () => {
    expect(applyCoupon({ ...base, minItems: 3 }, ctx).error).toBeTruthy();
    expect(applyCoupon({ ...base, minItems: 2 }, ctx).discount).toBe(60);
  });
  it("category only", () => expect(applyCoupon({ ...base, categories: ["hoodie"] }, ctx).discount).toBe(40));
  it("once per customer", () => expect(applyCoupon({ ...base, oncePerCustomer: true }, { ...ctx, usedCodes: ["vip20"] }).error).toBeTruthy());
  it("locked to customer ids", () => expect(applyCoupon({ ...base, customerIds: [99999] }, ctx).error).toBeTruthy());
  it("message targets round-trip", () => expect(unpackTag(packTag("Offer", [12345, 67890], "VIP20"))).toEqual({ tag: "Offer", to: [12345, 67890], coupon: "VIP20" }));
});
