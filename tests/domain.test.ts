import { test } from "node:test";
import assert from "node:assert/strict";
import { seed, reduceCommand, STAFF, staffSnapshot } from "../src/lib/demo";
import {
  checkoutSchema,
  expectedCash,
  payroll,
  businessDay,
} from "../src/lib/domain";
function opened() {
  return reduceCommand(seed(), {
    type: "open_shift",
    payload: { opening_cash: 100000 },
  });
}
function sale(s = opened()) {
  const p = {
    id: crypto.randomUUID(),
    shift_id: s.shifts[0].id,
    lines: [
      { product_id: s.products[0].id, quantity: 2, price: s.products[0].price },
    ],
    cash: 300000,
    transfer: 400000,
    occurred_at: new Date().toISOString(),
    offline: false,
  };
  return { s, p, result: reduceCommand(s, { type: "checkout", payload: p }) };
}
test("mixed payment creates one order and decrements stock", () => {
  const { s, result } = sale();
  assert.equal(result.orders[0].total, 700000);
  assert.equal(result.products[0].stock, s.products[0].stock - 2);
  assert.equal(expectedCash(result.shifts[0], result.orders), 400000);
});
test("checkout replay has exactly one effect", () => {
  const { p, result } = sale();
  const replay = reduceCommand(result, { type: "checkout", payload: p });
  assert.equal(replay.orders.length, 1);
  assert.equal(replay.products[0].stock, result.products[0].stock);
  assert.equal(replay.movements.length, 1);
});
test("checkout replay with changed tender is rejected", () => {
  const {p,result}=sale();
  assert.throws(()=>reduceCommand(result,{type:"checkout",payload:{...p,cash:p.cash+1,transfer:p.transfer-1}}));
});
test("cancellation restores inventory once and removes cash from expected closing", () => {
  const { s, result } = sale();
  const command = {
    type: "cancel",
    payload: { id: result.orders[0].id, reason: "Khách thay đổi" },
  };
  const cancelled = reduceCommand(result, command);
  assert.equal(cancelled.products[0].stock, s.products[0].stock);
  assert.equal(expectedCash(cancelled.shifts[0], cancelled.orders), 100000);
  assert.equal(reduceCommand(cancelled, command).movements.length, 2);
});
test("staff cannot cancel without policy permission or edit inventory", () => {
  const { result } = sale();
  result.user = result.members.find((m) => m.id === STAFF)!;
  assert.throws(() =>
    reduceCommand(result, {
      type: "cancel",
      payload: { id: result.orders[0].id, reason: "x" },
    }),
  );
  assert.throws(() =>
    reduceCommand(result, {
      type: "stock",
      payload: { id: result.products[0].id, quantity: 1, reason: "x" },
    }),
  );
});
test("staff snapshot excludes costs, finance, history, and colleagues", () => {
  const { result } = sale();
  result.user = result.members.find((m) => m.id === STAFF)!;
  const s = staffSnapshot(result);
  assert.equal(s.members.length, 1);
  assert.equal(s.orders.length, 0);
  assert.ok(s.products.every((p) => p.cost === undefined));
  assert.equal(s.audit.length, 0);
});
test("bad money and duplicate product lines are rejected", () => {
  const { p } = sale();
  assert.equal(checkoutSchema.safeParse({ ...p, cash: 1 }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...p, cash: -1 }).success, false);
  assert.equal(
    checkoutSchema.safeParse({
      ...p,
      lines: [...p.lines, ...p.lines],
      cash: 1000000,
      transfer: 400000,
    }).success,
    false,
  );
});
test("insufficient online stock leaves original data unchanged", () => {
  const s = opened();
  s.products[0].stock = 1;
  assert.throws(() => sale(s));
  assert.equal(s.products[0].stock, 1);
  assert.equal(s.orders.length, 0);
});
test("cash difference requires a note", () => {
  const s = opened();
  assert.throws(() =>
    reduceCommand(s, {
      type: "close_shift",
      payload: { id: s.shifts[0].id, actual_cash: 90000, note: "" },
    }),
  );
  const closed = reduceCommand(s, {
    type: "close_shift",
    payload: { id: s.shifts[0].id, actual_cash: 90000, note: "Kiểm đếm thiếu" },
  });
  assert.equal(closed.shifts[0].status, "submitted");
  assert.equal(closed.shifts[0].expected_cash, 100000);
});
test("only one open shift per employee", () => {
  assert.throws(() =>
    reduceCommand(opened(), {
      type: "open_shift",
      payload: { opening_cash: 0 },
    }),
  );
});
test("payroll uses elapsed minutes and integer rounding", () => {
  const s = opened();
  s.shifts[0].started_at = "2026-09-15T01:00:00Z";
  s.shifts[0].ended_at = "2026-09-15T09:30:00Z";
  assert.deepEqual(payroll(s.shifts, 25000, 1000000, 1), {
    minutes: 510,
    base: 212500,
    bonus: 10000,
    total: 222500,
  });
});
test("shop day uses Vietnam timezone around midnight", () => {
  assert.equal(businessDay("2026-09-15T18:00:00Z"), "2026-09-16");
});
