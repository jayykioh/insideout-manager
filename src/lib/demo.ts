import type { Snapshot, Command, Order } from "./types";
import {
  checkoutSchema,
  expectedCash,
  productSchema,
  settingsSchema,
} from "./domain";
export const ADMIN = "00000000-0000-4000-8000-000000000001";
export const STAFF = "00000000-0000-4000-8000-000000000002";
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function seed(): Snapshot {
  return {
    shop_id: uid(100),
    user: {
      id: ADMIN,
      name: "Minh Anh",
      role: "admin",
      active: true,
      hourly_rate: 35000,
      color: "#9cabbc",
    },
    members: [
      {
        id: ADMIN,
        name: "Minh Anh",
        role: "admin",
        active: true,
        hourly_rate: 35000,
        color: "#9cabbc",
      },
      {
        id: STAFF,
        name: "Hoàng Nam",
        role: "staff",
        active: true,
        hourly_rate: 25000,
        color: "#b4a18e",
      },
      {
        id: uid(3),
        name: "Thu Hà",
        role: "staff",
        active: true,
        hourly_rate: 25000,
        color: "#91a89a",
      },
    ],
    products: [
      {
        id: uid(11),
        name: "Essential Tee",
        sku: "IO-TEE-001",
        category: "Áo thun",
        variant: "Đen / M",
        price: 350000,
        cost: 140000,
        stock: 24,
        active: true,
        color: "#303333",
        kind: "tee",
      },
      {
        id: uid(12),
        name: "Everyday Oversized",
        sku: "IO-TEE-002",
        category: "Áo thun",
        variant: "Trắng / L",
        price: 390000,
        cost: 160000,
        stock: 18,
        active: true,
        color: "#e1dfd6",
        kind: "tee",
      },
      {
        id: uid(13),
        name: "Studio Hoodie",
        sku: "IO-HD-001",
        category: "Hoodie",
        variant: "Xám / L",
        price: 690000,
        cost: 280000,
        stock: 12,
        active: true,
        color: "#8b8c87",
        kind: "hoodie",
      },
      {
        id: uid(14),
        name: "Relaxed Cargo",
        sku: "IO-PT-001",
        category: "Quần",
        variant: "Olive / M",
        price: 590000,
        cost: 240000,
        stock: 8,
        active: true,
        color: "#666b5b",
        kind: "pants",
      },
      {
        id: uid(15),
        name: "Daily Tote",
        sku: "IO-BG-001",
        category: "Phụ kiện",
        variant: "Natural / One size",
        price: 220000,
        cost: 80000,
        stock: 32,
        active: true,
        color: "#c2b8a4",
        kind: "bag",
      },
      {
        id: uid(16),
        name: "Signature Cap",
        sku: "IO-CP-001",
        category: "Phụ kiện",
        variant: "Đen / One size",
        price: 250000,
        cost: 90000,
        stock: 5,
        active: true,
        color: "#353839",
        kind: "cap",
      },
      {
        id: uid(17),
        name: "Boxy Pocket Tee",
        sku: "IO-TEE-003",
        category: "Áo thun",
        variant: "Nâu / M",
        price: 420000,
        cost: 170000,
        stock: 16,
        active: true,
        color: "#837065",
        kind: "tee",
      },
      {
        id: uid(18),
        name: "Weekend Hoodie",
        sku: "IO-HD-002",
        category: "Hoodie",
        variant: "Kem / M",
        price: 720000,
        cost: 290000,
        stock: 9,
        active: true,
        color: "#c8c1af",
        kind: "hoodie",
      },
    ],
    orders: [],
    shifts: [],
    expenses: [],
    movements: [],
    audit: [],
    settings: {
      name: "Inside Out",
      address: "Vietnam · Everyday essentials",
      phone: "",
      receipt_footer: "Cảm ơn đã chọn Inside Out. Hẹn gặp lại!",
      idle_minutes: 10,
      allow_staff_cancel: false,
      theme: "dark",
      bonus_percent: 1,
    },
  };
}
export function reduceCommand(source: Snapshot, command: Command): Snapshot {
  const extra=operations(source,command);if(extra)return extra;
  const s = structuredClone(source);
  const p = command.payload;
  const admin = s.user.role === "admin";
  const now = new Date().toISOString();
  const audit = (action: string, detail: string) =>
    s.audit.unshift({
      id: crypto.randomUUID(),
      action,
      detail,
      actor_id: s.user.id,
      created_at: now,
    });
  const needAdmin = () => {
    if (!admin) throw Error("Chỉ quản lý được thực hiện thao tác này.");
  };
  switch (command.type) {
    case "checkout": {
      const c = checkoutSchema.parse(p);
      const previous=s.orders.find((o)=>o.id===c.id);
      if(previous){
        if(previous.user_id!==s.user.id||previous.shift_id!==c.shift_id||previous.cash!==c.cash||previous.transfer!==c.transfer||previous.created_at!==c.occurred_at||JSON.stringify(previous.lines.map(({product_id,quantity,price})=>({product_id,quantity,price})))!==JSON.stringify(c.lines.map(({product_id,quantity,price})=>({product_id,quantity,price}))))throw Error("Mã đơn đã được dùng cho nội dung khác.");
        return s;
      }
      const shift = s.shifts.find(
        (x) =>
          x.id === c.shift_id && x.user_id === s.user.id && x.status === "open",
      );
      if (!shift) throw Error("Bắt đầu ca làm trước khi thanh toán.");
      const lines = c.lines.map((l) => {
        const product = s.products.find(
          (x) => x.id === l.product_id && x.active,
        );
        if (!product) throw Error("Sản phẩm không còn được bán.");
        if (l.price !== product.price)
          throw Error("Giá đã thay đổi. Vui lòng thêm lại sản phẩm.");
        if (!c.offline && product.stock < l.quantity)
          throw Error("Số lượng vượt tồn kho.");
        product.stock -= l.quantity;
        s.movements.unshift({
          id: crypto.randomUUID(),
          product_id: product.id,
          quantity: -l.quantity,
          reason: "Bán hàng",
          created_at: now,
        });
        return { ...l, name: product.name, variant: product.variant };
      });
      s.orders.unshift({
        id: c.id,
        number: `IO-${String(s.orders.length + 1).padStart(5, "0")}`,
        user_id: s.user.id,
        shift_id: c.shift_id,
        created_at: c.occurred_at,
        total: c.cash + c.transfer,
        cost_total:c.lines.reduce((n,l)=>n+(s.products.find(x=>x.id===l.product_id)?.cost||0)*l.quantity,0),
        cash: c.cash,
        transfer: c.transfer,
        status: "completed",
        lines,
      });
      audit("checkout", c.id);
      break;
    }
    case "cancel": {
      if (!admin && !s.settings.allow_staff_cancel)
        throw Error("Đơn này cần quản lý hủy.");
      const o = s.orders.find((x) => x.id === p.id);
      if (!o || (!admin && o.user_id !== s.user.id))
        throw Error("Không tìm thấy đơn.");
      if (o.status === "cancelled") return s;
      const reason = String(p.reason || "").trim();
      if (!reason) throw Error("Nhập lý do hủy đơn.");
      o.status = "cancelled";
      o.reason = reason;
      for (const l of o.lines) {
        const product = s.products.find((x) => x.id === l.product_id);
        if (product) product.stock += l.quantity;
        s.movements.unshift({
          id: crypto.randomUUID(),
          product_id: l.product_id,
          quantity: l.quantity,
          reason: `Hủy ${o.number}: ${reason}`,
          created_at: now,
        });
      }
      audit("cancel", o.number + ": " + reason);
      break;
    }
    case "open_shift": {
      if (s.shifts.some((x) => x.user_id === s.user.id && x.status === "open"))
        throw Error("Đã có ca đang mở.");
      const opening = Number(p.opening_cash);
      if (!Number.isSafeInteger(opening) || opening < 0)
        throw Error("Tiền đầu ca không hợp lệ.");
      s.shifts.unshift({
        id: crypto.randomUUID(),
        user_id: s.user.id,
        started_at: now,
        ended_at: null,
        opening_cash: opening,
        actual_cash: null,
        expected_cash: null,
        note: "",
        status: "open",
      });
      audit("check_in", "Bắt đầu ca");
      break;
    }
    case "close_shift": {
      const shift = s.shifts.find(
        (x) => x.id === p.id && x.user_id === s.user.id && x.status === "open",
      );
      if (!shift) throw Error("Không có ca đang mở.");
      const actual = Number(p.actual_cash);
      if (!Number.isSafeInteger(actual) || actual < 0)
        throw Error("Tiền thực tế không hợp lệ.");
      const expected = expectedCash(shift, s.orders);
      if (actual !== expected && !String(p.note || "").trim())
        throw Error("Ghi chú lý do chênh lệch.");
      Object.assign(shift, {
        actual_cash: actual,
        expected_cash: expected,
        note: String(p.note || ""),
        ended_at: now,
        status: "submitted",
      });
      audit("close_shift", shift.id);
      break;
    }
    case "approve_shift": {
      needAdmin();
      const shift = s.shifts.find(
        (x) => x.id === p.id && x.status === "submitted",
      );
      if (!shift) throw Error("Ca chưa được gửi duyệt.");
      shift.status = "approved";
      audit("approve_shift", shift.id);
      break;
    }
    case "product": {
      needAdmin();
      const product = productSchema.parse(p);
      if (s.products.some((x) => x.sku === product.sku && x.id !== product.id))
        throw Error("SKU đã tồn tại.");
      const old = s.products.find((x) => x.id === product.id);
      if (old) Object.assign(old, { ...product, stock: old.stock });
      else s.products.unshift({ ...product, id: crypto.randomUUID() });
      audit("product", product.name);
      break;
    }
    case "stock": {
      needAdmin();
      const product = s.products.find((x) => x.id === p.id);
      const quantity = Number(p.quantity);
      if (
        !product ||
        !Number.isSafeInteger(quantity) ||
        !quantity ||
        !String(p.reason || "").trim()
      )
        throw Error("Nhập số lượng và lý do điều chỉnh.");
      product.stock += quantity;
      s.movements.unshift({
        id: crypto.randomUUID(),
        product_id: product.id,
        quantity,
        reason: String(p.reason),
        created_at: now,
      });
      audit("stock", product.sku);
      break;
    }
    case "expense": {
      needAdmin();
      const amount = Number(p.amount);
      if (
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        !String(p.note || "").trim()
      )
        throw Error("Nhập số tiền và nội dung chi phí.");
      s.expenses.unshift({
        id: crypto.randomUUID(),
        amount,
        category: String(p.category),
        note: String(p.note),
        created_at: now,
      });
      audit("expense", String(p.note));
      break;
    }
    case "member": {
      needAdmin();
      const name = String(p.name || "").trim();
      const rate = Number(p.hourly_rate);
      if (!name || !Number.isSafeInteger(rate) || rate < 0)
        throw Error("Thông tin nhân viên chưa hợp lệ.");
      const member = s.members.find((x) => x.id === p.id);
      if (
        member?.id === s.user.id &&
        (p.active === false || p.role !== "admin")
      )
        throw Error("Không thể tự khóa hoặc hạ quyền tài khoản quản lý.");
      if (member)
        Object.assign(member, {
          name,
          hourly_rate: rate,
          role: p.role === "admin" ? "admin" : "staff",
          active: p.active !== false,
        });
      else
        s.members.push({
          id: crypto.randomUUID(),
          name,
          hourly_rate: rate,
          role: "staff",
          active: true,
          color: "#8d9daa",
        });
      audit("member", name);
      break;
    }
    case "settings":
      needAdmin();
      s.settings = settingsSchema.parse(p);
      audit("settings", "Cập nhật cấu hình");
      break;
    default:
      throw Error("Thao tác không được hỗ trợ.");
  }
  return s;
}
export function staffSnapshot(s: Snapshot): Snapshot {
  if (s.user.role === "admin") return s;
  const shift = s.shifts.find(
    (x) => x.user_id === s.user.id && x.status === "open",
  );
  return {
    ...s,
    members: [s.user],
    products: s.products.map(({ cost, ...p }) => {
      void cost;
      return p;
    }),
    orders: s.orders.filter(
      (o) => o.user_id === s.user.id && o.shift_id === shift?.id,
    ).map(({cost_total,...o})=>{void cost_total;return o;}),
    shifts: s.shifts.filter(
      (x) => x.user_id === s.user.id && x.status === "open",
    ),
    expenses: [],
    movements: [],
    audit: [],
    pay_rules:[],payroll_periods:[],devices:[],
  };
}
export function receiptText(order: Order) {
  return `${order.number}\n${order.lines.map((l) => `${l.name} x${l.quantity}: ${l.price * l.quantity}`).join("\n")}\nTổng: ${order.total}`;
}
import {operations} from './operations';
