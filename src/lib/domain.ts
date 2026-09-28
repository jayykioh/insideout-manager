import { z } from "zod";
import type { Order, Shift } from "./types";
export const amount = z.number().int().min(0).max(1_000_000_000);
export const checkoutSchema = z
  .object({
    id: z.uuid(),
    shift_id: z.string().uuid().nullable().optional(),
    lines: z
      .array(
        z.object({
          product_id: z.uuid(),
          quantity: z.number().int().min(1).max(999),
          price: amount,
        }),
      )
      .min(1)
      .max(100),
    cash: amount,
    transfer: amount,
    card: amount,
    payment_method: z.enum(["cash", "bank_transfer", "card"]),
    discount: amount,
    note: z.string().trim().max(500),
    occurred_at: z.iso.datetime(),
    offline: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const subtotal = value.lines.reduce((s, l) => s + l.price * l.quantity, 0);
    if (value.discount > subtotal)
      ctx.addIssue({
        code: "custom",
        message: "Giảm giá không được vượt quá tạm tính.",
        path: ["discount"],
      });
    const total = subtotal - value.discount;
    if (total !== value.cash + value.transfer + value.card)
      ctx.addIssue({
        code: "custom",
        message: "Số tiền thanh toán chưa khớp tổng đơn.",
      });
    const expected = {
      cash: [total, 0, 0],
      bank_transfer: [0, total, 0],
      card: [0, 0, total],
    }[value.payment_method];
    if (
      value.cash !== expected[0] ||
      value.transfer !== expected[1] ||
      value.card !== expected[2]
    )
      ctx.addIssue({
        code: "custom",
        message: "Đơn chỉ được chọn một phương thức thanh toán.",
        path: ["payment_method"],
      });
    if (
      new Set(value.lines.map((l) => l.product_id)).size !== value.lines.length
    )
      ctx.addIssue({ code: "custom", message: "Sản phẩm bị trùng." });
  });
export const productSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().min(1).max(40),
  category: z.string().min(1),
  variant: z.string().min(1),
  price: amount,
  cost: amount,
  stock: z.number().int().min(0).max(999999),
  active: z.boolean(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  kind: z.enum(["tee", "hoodie", "pants", "bag", "cap"]),
});
export const settingsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  address: z.string().max(200),
  phone: z.string().max(30),
  receipt_footer: z.string().max(300),
  allow_staff_cancel: z.boolean(),
  theme: z.enum(["dark", "light"]),
  bonus_percent: z.number().min(0).max(100),
});
export const money = (n: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
export const date = (v: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(v));
export const businessDay = (v: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(v));
export const expectedCash = (shift: Shift, orders: Order[]) =>
  shift.opening_cash +
  orders
    .filter((o) => o.shift_id === shift.id && o.status === "completed")
    .reduce((s, o) => s + o.cash, 0);
export function payroll(
  shifts: Shift[],
  hourlyRate: number,
  sales: number,
  bonusPercent: number,
) {
  const minutes = shifts
    .filter((s) => s.ended_at)
    .reduce(
      (s, x) =>
        s +
        Math.max(
          0,
          (Date.parse(x.ended_at!) - Date.parse(x.started_at)) / 60000,
        ),
      0,
    );
  const base = Math.round((minutes / 60) * hourlyRate);
  return {
    minutes,
    base,
    bonus: Math.round((sales * bonusPercent) / 100),
    total: base + Math.round((sales * bonusPercent) / 100),
  };
}
