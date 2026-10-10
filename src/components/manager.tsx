"use client";
import {
  useEffect,
  useState,
  useRef,
  type FormEvent,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { IconButton, Empty, Field, Modal, ProductArt } from "@/components/ui";
import { Stat, ShiftTable } from "@/components/shared/stat-shift";
import NumberFlow from "@number-flow/react";
import { ProductFields } from "@/components/shared/product-fields";
const OperationsPanel = dynamic(() => import("./operations-panel"), {
  loading: () => <div className="skeleton" aria-label="Đang tải" />,
});
const Reports = dynamic(() => import("./reports"), {
  loading: () => <div className="skeleton" aria-label="Đang tải báo cáo" />,
});
import {
  ArrowUpRight,
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  ChevronRight,
  Clock,
  Cloud as CloudCheck,
  CloudOff,
  CreditCard,
  Download,
  Grid2X2,
  History,
  LayoutDashboard,
  LogOut,
  Minus,
  Plus,
  Pencil,
  Search,
  Settings as SettingsIcon,
  ShoppingBag,
  SlidersHorizontal,
  Sun,
  Moon,
  Trash2,
  UserCircle,
  X,
  RefreshCw,
  Printer,
  AlertCircle,
  ShieldCheck,
  LockKeyhole,
} from "lucide-react";
import type {
  Snapshot,
  Product,
  Order,
  Command,
  Member,
  Checkout,
} from "@/lib/types";
import { businessDay, date, expectedCash, money, payroll, readMoney } from "@/lib/domain";
import { SmartMoneyInput } from "./shared/smart-money-input";
import {
  demoLogin,
  execute,
  isDemo,
  lock,
  pending,
  profiles,
  submitCheckout,
  request,
  retryPending,
  snapshot,
  syncQueue,
  type Pending,
} from "@/lib/client";
import {
  getPermission,
  requestPermission,
  notifyCheckout,
  notifyCancel,
  notifyShiftOpen,
  notifyShiftClose,
  notifyExpense,
  notifySync,
  type NotifPermission,
} from "@/lib/notifications";

const navigation = [
  { href: "/pos", label: "Bán hàng", icon: ShoppingBag },
  { href: "/orders", label: "Đơn hàng", icon: History },
  { href: "/shift", label: "Ca làm việc", icon: Clock },
  { href: "/reports", label: "Báo cáo", icon: LayoutDashboard, admin: true },
  { href: "/admin/products", label: "Quản lý", icon: SettingsIcon, admin: true },
];

const adminTabs = [
  { href: "/admin/products", label: "Sản phẩm" },
  { href: "/admin/staff", label: "Nhân sự" },
  { href: "/admin/payroll", label: "Bảng lương" },
  { href: "/admin/attendance", label: "Chấm công" },
  { href: "/finance", label: "Thu chi" },
  { href: "/admin/settings", label: "Cài đặt" },
];
const titles: Record<string, [string, string]> = {
  "/admin/payroll": [
    "Bảng lương",
    "Rõ ràng từng giờ làm, trọn vẹn từng đóng góp.",
  ],
  "/admin/attendance": [
    "Chấm công",
    "Đối chiếu và điều chỉnh giờ làm thực tế.",
  ],
  "/pos": ["Bán hàng", "Một ngày mới. Những kết nối mới."],
  "/orders": ["Đơn hàng", "Mọi giao dịch, trong tầm tay."],
  "/shift": ["Ca làm việc", "Bắt đầu gọn gàng. Kết thúc rõ ràng."],
  "/attendance": ["Ca làm việc", "Thời gian và đóng góp của bạn."],
  "/reports": ["Tổng quan", "Nhìn lại hôm nay, chuẩn bị cho ngày mai."],
  "/admin/products": ["Sản phẩm", "Những điều làm nên Inside Out."],
  "/admin/inventory": ["Sản phẩm", "Từng sản phẩm, từng chuyển động."],
  "/admin/staff": ["Nhân sự", "Cùng nhau làm nên một ngày tốt hơn."],
  "/finance": ["Thu chi", "Rõ ràng trong từng khoản thu, chi."],
  "/admin/settings": ["Cài đặt", "Một không gian làm việc theo cách của bạn."],
  "/profile": ["Tài khoản", "Thông tin hồ sơ và bảo mật của bạn."],
};
const paymentNames: Record<Order["payment_method"], string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  card: "Quẹt thẻ",
};

export default function Manager() {
  const path = usePathname();
  const router = useRouter();
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState("dark");
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotifPermission>("default");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tất cả");

  const [discount, setDiscount] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [method, setMethod] = useState<"cash" | "transfer" | "card">("cash");
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [editPayment, setEditPayment] = useState<Order | null>(null);
  const [editCash, setEditCash] = useState("");
  const [editTransfer, setEditTransfer] = useState("");
  const [editCard, setEditCard] = useState("");
  const [cancelingOrder, setCancelingOrder] = useState<Order | null>(null);
  const [modal, setModal] = useState<
    | "product"
    | "stock"
    | "expense"
    | "member"
    | "shift-open"
    | "shift-close"
    | "queue"
    | "change-pin"
    | "qr"
    | null
  >(null);
  const [editing, setEditing] = useState<Product | Member | null>(null);
  const [mobileCart, setMobileCart] = useState(false);
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    actionLabel: string;
    action: () => void;
  } | null>(null);

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const [, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  // Track notification permission on mount
  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      if (mounted) setNotifPerm(getPermission());
    });
    return () => {
      mounted = false;
    };
  }, []);
  const handleRequestNotif = async () => {
    const perm = await requestPermission(data?.shop_id);
    setNotifPerm(perm);
  };
  const reload = async () => {
    const s = await snapshot();
    setData(s);
    setQueue(await pending());
    return s;
  };
  useEffect(() => {
    let alive = true;
    snapshot()
      .then((s) => {
        if (alive) {
          setData(s);
          const saved =
            localStorage.getItem("io-theme-" + s.user.id) || s.settings.theme;
          setTheme(saved);
          document.documentElement.dataset.theme = saved;
          pending().then(setQueue);
        }
      })
      .catch(() => {
        if (alive && !["/login", "/profiles"].includes(path))
          router.replace("/login");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path, router]);
  useEffect(() => {
    if (path === "/") {
      router.replace("/pos");
    }
  }, [path, router]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      } else {
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) =>
            Promise.all(registrations.map((registration) => registration.unregister())),
          )
          .then(() =>
            caches
              .keys()
              .then((keys) =>
                Promise.all(
                  keys
                    .filter((key) => key.startsWith("io-") || key.startsWith("workbox-"))
                    .map((key) => caches.delete(key)),
                ),
              ),
          )
          .catch(() => {});
      }
    }
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!online) return;
    const run = async () => {
      const currentData = dataRef.current;
      if (!currentData) return;
      try {
        await syncQueue(currentData);
        const fresh = await snapshot();
        const newOrders = fresh.orders.filter(
          (o) => !currentData.orders.some((prev) => prev.id === o.id) && o.user_id !== currentData.user.id
        );
        const newExpenses = fresh.expenses.filter(
          (e) => !currentData.expenses.some((prev) => prev.id === e.id)
        );
        for (const o of newOrders) {
          const m = fresh.members.find((x) => x.id === o.user_id)?.name || "Nhân viên";
          notifyCheckout(money(o.total), paymentNames[o.payment_method] + " (" + m + ")");
        }
        for (const e of newExpenses) {
          notifyExpense(e.note, money(e.amount));
        }
        setData(fresh);
        setQueue(await pending());
      } catch {
        /* A locked or disconnected session keeps its durable outbox. */
      }
    };
    const synced = (event: MessageEvent) => {
      if (event.data?.type === "OUTBOX_SYNCED") {
        const prevCount = queueRef.current.length;
        snapshot()
          .then(setData)
          .catch(() => {});
        pending()
          .then((q) => {
            setQueue(q);
            const synced = prevCount - q.length;
            if (synced > 0) notifySync(synced);
          })
          .catch(() => {});
      }
    };
    navigator.serviceWorker?.addEventListener("message", synced);
    run();
    window.addEventListener("focus", run);
    const timer = setInterval(run, 30000);
    return () => {
      window.removeEventListener("focus", run);
      navigator.serviceWorker?.removeEventListener("message", synced);
      clearInterval(timer);
    };
  }, [online]);
  // Idle timer completely removed by user request
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  async function mutate(command: Command) {
    setError("");
    setBusy(true);
    try {
      await execute(command);
      await reload();
      setModal(null);
      setNotice("Đã lưu thay đổi.");
      // Fire relevant notifications
      if (command.type === "open_shift") notifyShiftOpen();
      if (command.type === "close_shift") {
        const shiftSales = data
          ? data.orders
              .filter((o) => o.status === "completed" && o.shift_id === (command.payload as {id?: string}).id)
              .reduce((s, o) => s + o.total, 0)
          : 0;
        notifyShiftClose(money(shiftSales));
      }
      if (command.type === "expense") {
        notifyExpense(
          String((command.payload as {note?: string}).note ?? ""),
          money(Number((command.payload as {amount?: number}).amount ?? 0)),
        );
      }
      if (command.type === "cancel") {
        const orderId = String((command.payload as {id?: string}).id ?? "");
        const reason = String((command.payload as {reason?: string}).reason ?? "");
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            orders: prev.orders.map((o) =>
              o.id === orderId ? { ...o, status: "cancelled", reason } : o
            ),
          };
        });
        const order = data?.orders.find((o) => o.id === orderId);
        notifyCancel(order?.number ?? orderId.slice(0, 8).toUpperCase());
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    if (data) {
      localStorage.setItem("io-theme-" + data.user.id, next);
      execute({ type: "preference", payload: { theme: next } }).catch(() => {});
    }
  }
  async function switchProfile() {
    await lock();
    setData(null);
    setCart({});
    setCustomPrices({});
    router.push("/profiles");
  }
  if (path === "/") {
    return null;
  }
  if (path === "/login" || path === "/profiles")
    return <Login onSuccess={() => router.push("/pos")} />;
  if (loading || !data)
    return (
      <div className="loading-page">
        <div className="brand-symbol">InsideOut</div>
        <p>SYS/BOOTING...</p>
        <div className="skeleton" />
      </div>
    );
  const admin = data.user.role === "admin";
  const current = admin
    ? undefined
    : data.shifts.find(
        (s) => s.user_id === data.user.id && s.status === "open",
      );
  const isProducts = ["/admin/products", "/admin/inventory"].includes(path);
  const isShift = ["/shift", "/attendance"].includes(path);
  const title = titles[path] || [
    "Không tìm thấy trang",
    "Quay về bán hàng để tiếp tục.",
  ];
  const lines = Object.entries(cart)
    .map(([id, quantity]) => {
      const product = data.products.find((p) => p.id === id)!;
      return {
        product,
        quantity,
        price: product ? (customPrices[id] ?? product.price) : 0,
      };
    })
    .filter((l) => l.product);
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const discountVal = discount === "" ? 0 : Number(discount);
  const total = subtotal - discountVal;
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);
  const selected = data.products.filter(
    (p) =>
      p.active &&
      (category === "Tất cả" || p.category === category) &&
      (p.name + " " + p.sku + " " + p.variant)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const today = businessDay(new Date().toISOString());
  const sales = data.orders.filter((o) => o.status === "completed");
  const todaySales = sales.filter((o) => businessDay(o.created_at) === today);
  const changeQty = (id: string, delta: number) =>
    setCart((old) => {
      const n = { ...old };
      n[id] = Math.max(0, (n[id] || 0) + delta);
      if (!n[id]) delete n[id];
      return n;
    });
  async function checkout() {
    if (!current && !admin) return;
    setBusy(true);
    setError("");
    const id = crypto.randomUUID();
    const cashAmount = method === "cash" ? total : 0;
    const transferAmount = method === "transfer" ? total : 0;
    const cardVal = method === "card" ? total : 0;
    
    const payload: Checkout = {
      id,
      shift_id: current?.id,
      lines: lines.map((l) => ({
        product_id: l.product.id,
        quantity: l.quantity,
        price: l.price,
      })),
      cash: cashAmount,
      transfer: transferAmount,
      card: cardVal,
      payment_method: method === "transfer" ? "bank_transfer" : method,
      discount: discountVal,
      note,
      occurred_at: new Date().toISOString(),
      offline: !online,
    };
    try {
      if (
        !Number.isSafeInteger(discountVal) ||
        discountVal < 0 ||
        discountVal > subtotal
      )
        throw Error("Giảm giá phải là số nguyên và không vượt quá tạm tính.");
      if (note.trim().length > 500)
        throw Error("Ghi chú không được vượt quá 500 ký tự.");
      if (
        !Number.isSafeInteger(cashAmount) ||
        cashAmount < 0 ||
        cashAmount > total
      )
        throw Error("Số tiền mặt phải nằm trong tổng giá trị đơn.");

      const orderData: Order = {
        id,
        number: "POS-" + id.slice(0, 8).toUpperCase(),
        user_id: data!.user.id,
        shift_id: current?.id,
        created_at: payload.occurred_at,
        total,
        cash: payload.cash,
        transfer: payload.transfer,
        card: payload.card,
        payment_method: payload.payment_method,
        discount: payload.discount,
        note: payload.note,
        status: "completed",
        sync: "pending",
        lines: lines.map(({ product, quantity, price }) => ({
          product_id: product.id,
          name: product.name,
          variant: product.variant,
          price: price,
          quantity,
        })),
      };

      setData((prev) => {
        if (!prev) return prev;
        const newProducts = prev.products.map((p) => {
          const inCart = lines.find((l) => l.product.id === p.id);
          if (inCart) return { ...p, stock: p.stock - inCart.quantity };
          return p;
        });
        return { ...prev, orders: [orderData, ...prev.orders], products: newProducts };
      });
      setReceipt(orderData);
      setCart({});
      setCustomPrices({});
      setDiscount("");
      setNote("");
      setMethod("cash");
      setMobileCart(false);

      submitCheckout(data!, payload)
        .then((delivered) => {
          if (!delivered) {
            pending().then(setQueue);
            setNotice("Đơn đã lưu trên thiết bị, chờ đồng bộ.");
            notifyCheckout(money(total), paymentNames[payload.payment_method]);
          } else {
            setData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                orders: prev.orders.map((o) =>
                  o.id === id ? { ...o, sync: undefined } : o
                ),
              };
            });
            setReceipt((prev) =>
              prev?.id === id ? { ...prev, sync: undefined } : prev
            );
            setNotice("Thanh toán thành công.");
            notifyCheckout(money(total), paymentNames[payload.payment_method]);
            reload().catch(console.error);
          }
        })
        .catch(console.error);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submitForm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (key: string) => String(f.get(key) || "");
    const num = (key: string) => Number(f.get(key));
    if (modal === "change-pin") {
      try {
        await request("auth/change-pin", { old_pin: str("old_pin"), new_pin: str("new_pin") });
        setModal(null);
        setNotice("Đổi mã PIN thành công.");
      } catch (e) {
        setError((e as Error).message);
      }
      return;
    }
    if (modal === "product")
      await mutate({
        type: "product",
        payload: {
          id: editing?.id,
          name: str("name"),
          sku: str("sku"),
          category: str("category"),
          variant: str("variant"),
          price: num("price"),
          cost: num("cost"),
          stock: num("stock"),
          active: true,
          color: str("color"),
          kind: str("kind"),
        },
      });
    if (modal === "stock")
      await mutate({
        type: "stock",
        payload: {
          id: editing?.id,
          quantity: num("quantity"),
          reason: str("reason"),
        },
      });
    if (modal === "expense")
      await mutate({
        type: "expense",
        payload: {
          amount: num("amount"),
          category: str("category"),
          note: str("note"),
        },
      });
    if (modal === "member")
      await mutate({
        type: "member",
        payload: {
          id: editing?.id,
          name: str("name"),
          hourly_rate: num("hourly_rate"),
          role: str("role"),
          active: true,
          pin: str("pin"),
        },
      });
    if (modal === "shift-open")
      await mutate({
        type: "open_shift",
        payload: { opening_cash: num("opening_cash") },
      });
    if (modal === "shift-close")
      await mutate({
        type: "close_shift",
        payload: {
          id: current?.id,
          actual_cash: num("actual_cash"),
          note: str("note"),
        },
      });
  }
  const cartPanel = (
    <>
      <div className="cart-heading">
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 600 }}>
            Đơn hàng mới
          </h2>
          <span style={{ fontSize: "12px", marginTop: "2px", display: "block" }}>{itemCount} sản phẩm đang chọn</span>
        </div>
        <IconButton
          label="Xóa giỏ hàng"
          onClick={() => {
            if (!itemCount) return;
            setDialog({
              title: "Xóa giỏ hàng",
              message: "Bạn có chắc chắn muốn xóa toàn bộ sản phẩm trong giỏ hàng?",
              actionLabel: "Xóa",
              action: () => { setCart({}); setCustomPrices({}); }
            });
          }}
        >
          <Trash2 size={18} />
        </IconButton>
      </div>
      <div className="cart-lines">
        {lines.length ? (
          lines.map(({ product: p, quantity, price }) => (
            <div className="cart-line" key={p.id}>
              <ProductArt product={p} small />
              <div className="cart-line-info">
                <strong>{p.name}</strong>
                <span>{p.variant}</span>
                <div className="quantity">
                  <button
                    aria-label={"Giảm " + p.name}
                    onClick={() => changeQty(p.id, -1)}
                  >
                    <Minus size={14} />
                  </button>
                  <b>{quantity}</b>
                  <button
                    aria-label={"Tăng " + p.name}
                    onClick={() => changeQty(p.id, 1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                <span className="money" style={{ fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap" }}>
                  {money(price * quantity)}
                </span>
                {admin && (
                  <button
                    className="text-button"
                    style={{ fontSize: "11px", color: "var(--muted)", padding: "2px 0" }}
                    onClick={() => {
                      const val = window.prompt(`Sửa giá cho ${p.name}:`, String(price));
                      if (val !== null) {
                        const parsed = parseInt(val.replace(/\D/g, ""), 10);
                        if (!isNaN(parsed) && parsed >= 0) {
                          setCustomPrices(old => ({ ...old, [p.id]: parsed }));
                        }
                      }
                    }}
                  >
                    <Pencil size={11} style={{ marginRight: 4 }} /> Sửa giá
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <Empty
            title="Bắt đầu một đơn hàng"
            detail="Chọn sản phẩm để thêm vào giỏ."
          />
        )}
      </div>
      <div className="cart-bottom">
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div className="summary-row" style={{ color: "var(--muted)", fontSize: "12px" }}>
            <span>Tạm tính</span>
            <span style={{ fontWeight: 700, color: "var(--text)", fontSize: "14px" }}>{money(subtotal)}</span>
          </div>
          <div className="summary-row" style={{ color: "var(--muted)", fontSize: "12px" }}>
            <span>Số lượng</span>
            <span style={{ fontWeight: 600, color: "var(--text)" }}>{itemCount} sản phẩm</span>
          </div>
        </div>
        
        <div className="cart-fields">
          <Field label="Giảm giá (₫)">
            <SmartMoneyInput
              type="number"
              min="0"
              max={subtotal}
              value={discount}
              onValueChange={setDiscount}
              placeholder="Nhập số tiền giảm..."
              style={{ fontSize: "14px" }}
            />
          </Field>
          {showNote || note ? (
            <Field label="Ghi chú">
              <input
                type="text"
                placeholder="VD: Khách hàng VIP..."
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                style={{ fontSize: "14px" }}
                autoFocus={!note}
              />
            </Field>
          ) : (
            <button 
              className="text-button" 
              style={{ fontSize: "12px", padding: 0, justifyContent: "flex-start", color: "var(--muted)" }}
              onClick={() => setShowNote(true)}
            >
              + Thêm ghi chú
            </button>
          )}
        </div>

        <div className="payment-methods cart-payment-methods">
          {[
            ["cash", "Tiền mặt"],
            ["transfer", "Chuyển khoản"],
            ["card", "Quẹt thẻ"],
          ].map(([v, l]) => (
            <button
              key={v}
              className={method === v ? "selected" : ""}
              style={{ padding: "6px 4px", fontSize: "11px", gap: "2px" }}
              onClick={() => {
                setMethod(v as "cash" | "transfer" | "card");
                if (v === "transfer") setModal("qr");
              }}
            >
              <CreditCard size={14} style={{ marginBottom: "2px" }} />
              {l}
            </button>
          ))}
        </div>

        {method === "transfer" && (
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <img 
              src="/qr-code-transfer.jpg" 
              alt="QR Code" 
              style={{ width: "100%", maxWidth: "160px", borderRadius: "8px", border: "1px solid var(--border)", cursor: "pointer", display: "block", margin: "0 auto" }}
              onClick={() => setModal("qr")}
            />
            <p className="form-hint" style={{ marginTop: 8, fontSize: "11px" }}>
              Kiểm tra tiền đã vào tài khoản trước khi xác nhận.
            </p>
          </div>
        )}

        <div className="total-row" style={{ fontSize: "16px", marginTop: "4px", marginBottom: "0" }}>
          <strong>Tổng cộng</strong>
          <strong>{money(total)}</strong>
        </div>
        <div style={{ textAlign: "right", fontSize: "12px", color: "var(--muted)", fontStyle: "italic", marginBottom: "8px", marginTop: "2px" }}>
          ({readMoney(total)})
        </div>
        
        {error && (
          <p role="alert" className="form-error" style={{ marginBottom: 12 }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
          <button 
            className="secondary" 
            style={{ flex: 1, padding: "10px 12px", fontSize: "13px", fontWeight: 500, justifyContent: "center" }} 
            onClick={() => window.print()}
            disabled={!itemCount}
          >
            <Printer size={16} style={{ marginRight: 6 }} /> In bill
          </button>
          <button
            className="primary checkout-button"
            style={{ flex: 1.5, padding: "10px 12px", fontSize: "13px", fontWeight: 500, justifyContent: "center" }}
            disabled={!itemCount || busy}
            data-state={busy ? "loading" : undefined}
            onClick={() => {
              if (!current && !admin) {
                setModal("shift-open");
                return;
              }
              checkout();
            }}
          >
            Thanh toán
          </button>
        </div>
        
        <p className="secure-note" style={{ marginTop: 16, fontSize: "11px", color: "var(--muted)" }}>
          <ShieldCheck size={14} style={{ marginRight: 4 }} />
          Giao dịch được ghi nhận an toàn
        </p>
      </div>
    </>
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Đến nội dung
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/pos">
          <div className="brand-symbol">
            <span className="full-logo">InsideOut</span>
            <span className="short-logo">IO</span>
          </div>
        </Link>
        <nav>
          {navigation
            .filter(
              (n) => (!n.admin || admin) && !(admin && n.href === "/shift"),
            )
            .map((n) => (
              <Link
                key={n.href}
                aria-label={n.label}
                href={n.href}
                className={
                  (n.href === "/admin/products"
                    ? path.startsWith("/admin") || path === "/finance"
                    : path === n.href)
                    ? "active"
                    : ""
                }
              >
                <n.icon size={20} strokeWidth={1.6} />
                <span>{n.label}</span>
              </Link>
            ))}
          <button className="mobile-logout" onClick={() => router.push("/profile")}>
            <UserCircle size={20} strokeWidth={1.6} />
            <span>Tài khoản</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <button className="user-card" onClick={() => router.push("/profile")}>
            <span className="avatar" style={{ background: data.user.color }}>
              {data.user.name.split(" ").at(-1)?.[0]}
            </span>
            <span>
              <strong>{data.user.name}</strong>
            </span>
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="top-actions">
            <button className="sync-button" onClick={() => setModal("queue")}>
              {online ? <CloudCheck size={16} /> : <CloudOff size={16} />}
              {queue.length > 0 && <span>{queue.length} chờ đồng bộ</span>}
              {!online && queue.length === 0 && <span>Mất kết nối</span>}
            </button>
            {notifPerm !== "unsupported" && notifPerm !== "granted" && (
              <button
                className="notif-request-btn"
                onClick={handleRequestNotif}
                aria-label="Bật thông báo"
                title={notifPerm === "denied" ? "Thông báo bị chặn - hãy bật lại trong trình duyệt" : "Bật thông báo"}
              >
                <Bell size={16} />
                <span className="today-label">
                  {notifPerm === "denied" ? "Thông báo bị chặn" : "Bật thông báo"}
                </span>
              </button>
            )}
            {notifPerm === "granted" && (
              <IconButton label="Thông báo đã bật" onClick={() => {}}>
                <Bell size={18} style={{ color: "var(--success)" }} />
              </IconButton>
            )}
            <IconButton label="Đổi giao diện" onClick={toggleTheme}>
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
          </div>
        </header>
        {(path.startsWith("/admin") || path === "/finance") && admin && (
          <div className="admin-tabs">
            {adminTabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={path === t.href ? "active" : ""}
              >
                {t.label}
              </Link>
            ))}
          </div>
        )}
        <main id="main" className={path === "/pos" ? "main pos-main" : "main"}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">INSIDE OUT MANAGER</div>
              <h1>
                {title[0]}
              </h1>
              <p>{title[1]}</p>
            </div>
            {path === "/pos" ? (
              <div className="sales-today">
                <span>Doanh thu hôm nay</span>
                <strong>
                  <NumberFlow value={todaySales.reduce((s, o) => s + o.total, 0)} locales="vi-VN" format={{ style: 'currency', currency: 'VND', maximumFractionDigits: 0 }} />
                </strong>
                <small>
                  <NumberFlow value={todaySales.length} /> đơn hoàn thành <ArrowUpRight size={13} />
                </small>
              </div>
            ) : isProducts ? (
              <button
                className="primary"
                onClick={() => {
                  setEditing(null);
                  setModal("product");
                }}
              >
                <Plus size={17} />
                Thêm sản phẩm
              </button>
            ) : path === "/finance" ? (
              <button className="primary" onClick={() => setModal("expense")}>
                <Plus size={17} />
                Ghi chi phí
              </button>
            ) : path === "/admin/staff" ? (
              <button
                className="primary"
                onClick={() => {
                  setEditing(null);
                  setModal("member");
                }}
              >
                <Plus size={17} />
                Thêm nhân viên
              </button>
            ) : null}
          </div>
          {error && (
            <div className="alert" role="alert">
              <AlertCircle size={18} />
              {error}
              <IconButton label="Đóng lỗi" onClick={() => setError("")}>
                <X size={16} />
              </IconButton>
            </div>
          )}
          {!admin &&
          (path.startsWith("/admin") ||
            path === "/reports" ||
            path === "/finance") ? (
            <Empty
              title="Khu vực dành cho quản lý"
              detail="Chọn tài khoản quản lý để tiếp tục."
              action={
                <button className="primary" onClick={switchProfile}>
                  Đổi hồ sơ
                </button>
              }
            />
          ) : (
            <>
              {path === "/pos" && (
                <div className="pos-layout">
                  <section className="catalog">
                    <div className="catalog-toolbar">
                      <label className="search">
                        <Search size={18} />
                        <input
                          aria-label="Tìm sản phẩm"
                          placeholder="Tìm tên sản phẩm, mã SKU…"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                        <kbd>/</kbd>
                      </label>
                      <IconButton
                        label="Xóa bộ lọc"
                        onClick={() => {
                          setSearch("");
                          setCategory("Tất cả");
                        }}
                      >
                        <SlidersHorizontal size={18} />
                      </IconButton>
                    </div>
                    <div className="category-tabs">
                      {[
                        "Tất cả",
                        ...new Set(
                          data.products
                            .filter((p) => p.active)
                            .map((p) => p.category),
                        ),
                      ].map((c) => (
                        <button
                          className={category === c ? "selected" : ""}
                          key={c}
                          onClick={() => setCategory(c)}
                        >
                          {c === "Tất cả" && <Grid2X2 size={14} />} {c}
                        </button>
                      ))}
                    </div>
                    <div className="catalog-meta">
                      <span>{selected.length} sản phẩm</span>
                      <span>
                        Sắp xếp: <b>Mặc định</b>
                      </span>
                    </div>
                    <div className="product-grid">
                      {selected.map((p) => (
                        <button
                          disabled={p.stock <= 0}
                          className="product-card"
                          key={p.id}
                          onClick={() => {
                            if ((cart[p.id] || 0) >= p.stock) {
                              setNotice("Đã đạt số lượng tồn kho.");
                              return;
                            }
                            changeQty(p.id, 1);
                          }}
                        >
                          <div className="art-wrap">
                            <ProductArt product={p} />
                            <span
                              className={
                                "stock-badge " + (p.stock <= 5 ? "low" : "")
                              }
                            >
                              {p.stock <= 0 ? "Hết hàng" : "Còn " + p.stock}
                            </span>
                            <span className="add-product">
                              <Plus size={18} />
                            </span>
                            {!!cart[p.id] && (
                              <span className="in-cart">
                                <Check size={12} />
                                {cart[p.id]}
                              </span>
                            )}
                          </div>
                          <div className="product-info">
                            <h3>{p.name}</h3>
                            <p>{p.variant}</p>
                            <div>
                              <strong>{money(p.price)}</strong>
                              <span
                                className="color-swatch"
                                style={{ background: p.color }}
                              />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    {!selected.length && (
                      <Empty
                        title="Chưa tìm thấy sản phẩm"
                        detail="Thử tên hoặc mã SKU khác."
                        action={
                          <button
                            className="secondary"
                            onClick={() => {
                              setSearch("");
                              setCategory("Tất cả");
                            }}
                          >
                            Xóa bộ lọc
                          </button>
                        }
                      />
                    )}
                    <div className="catalog-footer">
                      <span>inside out © {new Date().getFullYear()}</span>
                    </div>
                  </section>
                  <aside
                    className={
                      "cart-panel " + (mobileCart ? "mobile-open" : "")
                    }
                  >
                    {mobileCart && (
                      <button
                        className="text-button mobile-close"
                        onClick={() => setMobileCart(false)}
                      >
                        <ArrowLeft size={16} />
                        Tiếp tục chọn sản phẩm
                      </button>
                    )}
                    {cartPanel}
                  </aside>
                  {!mobileCart && (
                    <button
                      className="mobile-cart-toggle primary"
                      onClick={() => setMobileCart(true)}
                    >
                      <ShoppingBag size={18} />
                      {itemCount} sản phẩm <strong>{money(total)}</strong>
                    </button>
                  )}
                </div>
              )}
              {path === "/orders" && (
                <section className="panel">
                  <div className="section-toolbar">
                    <h2>
                      Lịch sử giao dịch{" "}
                      <span className="count">{data.orders.length}</span>
                    </h2>
                    <label className="search compact">
                      <Search size={16} />
                      <input
                        aria-label="Tìm đơn hàng"
                        placeholder="Tìm mã đơn…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                  </div>
                  {!data.orders.length ? (
                    <Empty
                      title="Chưa có đơn hàng"
                      detail="Đơn hàng hoàn thành sẽ được hiển thị tại đây."
                      action={
                        <Link className="primary" href="/pos">
                          Tạo đơn đầu tiên
                        </Link>
                      }
                    />
                  ) : (
                    <div className="panel-group" style={{ gap: 24 }}>
                      {(() => {
                        const filtered = data.orders.filter((o) =>
                          o.number.toLowerCase().includes(search.toLowerCase()),
                        );
                        
                        // Group by Month -> Day
                        type OrderList = typeof data.orders;
                        const grouped: Record<string, Record<string, OrderList>> = {};
                        
                        filtered.forEach((o) => {
                          const d = new Date(o.created_at);
                          const monthKey = `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
                          const dayKey = `Ngày ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                          
                          if (!grouped[monthKey]) grouped[monthKey] = {};
                          if (!grouped[monthKey][dayKey]) grouped[monthKey][dayKey] = [];
                          grouped[monthKey][dayKey].push(o);
                        });

                        return Object.entries(grouped).map(([monthKey, days]) => (
                          <div key={monthKey} className="month-group" style={{ marginBottom: 16 }}>
                            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "24px 0 16px", color: "var(--fg)", letterSpacing: "-0.01em" }}>
                              {monthKey}
                            </h2>
                            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                              {Object.entries(days).map(([dayKey, ordersInDay]) => (
                                <div key={dayKey} className="day-group">
                                  <h4 style={{ margin: "0 0 10px 20px", fontSize: 13, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                                    {dayKey}
                                  </h4>
                                  <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
                                    {ordersInDay.map((o, index, arr) => (
                                      <div 
                                        className="clickable-card" 
                                        key={o.id} 
                                        onClick={() => setReceipt(o)}
                                        style={{ 
                                          padding: "16px 20px", 
                                          borderBottom: index < arr.length - 1 ? "1px solid var(--border)" : "none",
                                          opacity: o.status === "cancelled" ? 0.55 : 1,
                                          background: o.status === "cancelled" ? "rgba(0,0,0,0.02)" : "transparent"
                                        }}
                                      >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 600, textDecoration: o.status === "cancelled" ? "line-through" : "none" }}>
                                              <span style={{ color: "var(--muted)", fontWeight: 400, marginRight: 4, textDecoration: "none" }}>Đơn</span>
                                              {o.number}
                                            </h3>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 13, color: "var(--muted)" }}>
                                              <span style={{ fontWeight: 500, color: "var(--fg)" }}>
                                                {new Date(o.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                                              </span>
                                              <span style={{ opacity: 0.4 }}>•</span>
                                              <span>{paymentNames[o.payment_method]}</span>
                                              <span style={{ opacity: 0.4 }}>•</span>
                                              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                                <UserCircle size={14} style={{ opacity: 0.8 }} />
                                                {data.members.find((m) => m.id === o.user_id)?.name || "N/A"}
                                              </span>
                                            </div>
                                          </div>
                                          <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
                                            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                                              <strong className="money" style={{ fontSize: 16, color: o.status === "cancelled" ? "var(--muted)" : "var(--accent-bright)", lineHeight: 1 }}>
                                                {money(o.total)}
                                              </strong>
                                              <span className={"badge " + (o.status === "cancelled" ? "danger" : "success")} style={{ fontSize: 11, padding: "3px 8px" }}>
                                                {o.status === "cancelled" ? "Đã hủy" : "Hoàn thành"}
                                              </span>
                                            </div>
                                            <ChevronRight size={20} color="var(--muted)" style={{ opacity: 0.5 }} />
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </section>
              )}
              {admin && path === "/shift" && (
                <Empty
                  title="Ca làm việc dành cho nhân viên"
                  detail="Quản lý có thể bán hàng mà không cần chấm công vào hoặc kết ca."
                  action={
                    <Link className="primary" href="/pos">
                      Quay lại bán hàng
                    </Link>
                  }
                />
              )}
              {isShift && !admin && (
                <>
                  <div className="grid-3">
                    <Stat
                      label="Trạng thái hôm nay"
                      value={current ? "Đang trong ca" : admin ? "Sẵn sàng bán hàng" : "Chưa mở ca"}
                      detail={
                        current
                          ? "Bắt đầu " + date(current.started_at)
                          : admin
                            ? "Quản trị viên không yêu cầu mở ca"
                            : "Sẵn sàng cho một ngày mới"
                      }
                    />
                    <Stat
                      label="Doanh thu trong ca"
                      value={sales
                          .filter((o) => o.shift_id === current?.id)
                          .reduce((s, o) => s + o.total, 0)}
                      detail="Chỉ tính đơn hoàn thành"
                    />
                    <Stat
                      label="Tiền mặt dự kiến"
                      value={current ? expectedCash(current, data.orders) : 0}
                      detail="Bao gồm tiền mặt đầu ca"
                    />
                  </div>
                  <section className="panel shift-panel">
                      <div className="shift-icon">
                        <Clock size={32} />
                      </div>
                      <h2>
                        {current
                          ? "Mọi thứ đang diễn ra tốt đẹp."
                          : "Bắt đầu ca làm việc của bạn."}
                      </h2>
                      <p>
                        {current
                          ? "Khi hoàn thành ngày làm việc, kiểm đếm tiền mặt và gửi kết ca."
                          : "Chấm công và nhập số tiền mặt đầu ca trước khi bán hàng."}
                      </p>
                      <button
                        className="primary"
                        onClick={() =>
                          setModal(current ? "shift-close" : "shift-open")
                        }
                      >
                        {current
                          ? "Kết ca & chấm công ra"
                          : "Chấm công vào & mở ca"}
                        <ArrowUpRight size={17} />
                      </button>
                  </section>
                  <ShiftTable
                    data={data}
                    onApprove={(id) =>
                      mutate({ type: "approve_shift", payload: { id } })
                    }
                  />
                </>
              )}
              {isProducts && (
                <section className="panel">
                  <div className="section-toolbar">
                    <h2>
                      Danh mục sản phẩm{" "}
                      <span className="count">{data.products.length}</span>
                    </h2>
                    <label className="search compact">
                      <Search size={16} />
                      <input
                        aria-label="Lọc sản phẩm"
                        placeholder="Tên hoặc SKU…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="table-wrap">
                    <table className="products-table">
                      <thead>
                        <tr>
                          <th>Sản phẩm</th>
                          <th>SKU</th>
                          <th>Giá bán</th>
                          <th>Giá vốn</th>
                          <th>Tồn kho</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.products
                          .filter((p) =>
                            (p.name + " " + p.sku)
                              .toLowerCase()
                              .includes(search.toLowerCase()),
                          )
                          .map((p) => (
                            <tr key={p.id}>
                              <td data-label="Sản phẩm">
                                <div className="product-cell">
                                  <ProductArt product={p} small />
                                  <div>
                                    <strong>{p.name}</strong>
                                    <small>
                                      {p.variant}
                                      {!p.active ? " · Đã lưu trữ" : ""}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td className="muted" data-label="SKU">{p.sku}</td>
                              <td className="money" data-label="Giá bán">{money(p.price)}</td>
                              <td className="money muted" data-label="Giá vốn">
                                {money(p.cost || 0)}
                              </td>
                              <td data-label="Tồn kho">
                                <span
                                  className={
                                    "badge " + (p.stock <= 5 ? "warning" : "")
                                  }
                                >
                                  {p.stock}
                                </span>
                              </td>
                              <td data-label="Thao tác">
                                <div className="row-actions">
                                  <button
                                    className="text-button"
                                    onClick={() => {
                                      setEditing(p);
                                      setModal("product");
                                    }}
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    className="text-button"
                                    onClick={() => {
                                      setEditing(p);
                                      setModal("stock");
                                    }}
                                  >
                                    Điều chỉnh kho
                                  </button>
                                  <button
                                    className="text-button"
                                    onClick={() => {
                                      setDialog({
                                        title: p.active ? "Lưu trữ sản phẩm" : "Khôi phục sản phẩm",
                                        message: p.active 
                                          ? `Bạn có chắc chắn muốn lưu trữ sản phẩm ${p.name}?` 
                                          : `Bạn có chắc chắn muốn khôi phục sản phẩm ${p.name}?`,
                                        actionLabel: p.active ? "Lưu trữ" : "Khôi phục",
                                        action: () => mutate({
                                          type: "product",
                                          payload: { ...p, active: !p.active },
                                        })
                                      });
                                    }}
                                  >
                                    {p.active ? "Lưu trữ" : "Khôi phục"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {path === "/admin/staff" && (
                <div className="grid-3">
                  {data.members.map((m) => {
                    const shifts = data.shifts.filter(
                      (s) => s.user_id === m.id,
                    );
                    const salesTotal = sales
                      .filter((o) => o.user_id === m.id)
                      .reduce((s, o) => s + o.total, 0);
                    const pay = payroll(
                      shifts,
                      m.hourly_rate,
                      salesTotal,
                      data.settings.bonus_percent,
                    );
                    return (
                      <section className="panel staff-card" key={m.id}>
                        <div className="staff-card-top">
                          <span
                            className="avatar large"
                            style={{ background: m.color }}
                          >
                            {m.name.split(" ").at(-1)?.[0]}
                          </span>
                          <span className="badge">
                            {m.role === "admin" ? "Quản lý" : "Nhân viên"}
                          </span>
                        </div>
                        <h2>{m.name}</h2>
                        <p className="muted">
                          {m.active ? "Đang hoạt động" : "Đã vô hiệu hóa"}
                        </p>
                        <div className="staff-metrics">
                          <div>
                            <span>Giờ đã làm</span>
                            <strong>{(pay.minutes / 60).toFixed(1)}h</strong>
                          </div>
                          <div>
                            <span>Doanh số</span>
                            <strong>{money(salesTotal)}</strong>
                          </div>
                          <div>
                            <span>Lương tạm tính</span>
                            <strong>{money(pay.total)}</strong>
                          </div>
                        </div>
                        <p className="muted small-text">
                          {money(m.hourly_rate)}/giờ +{" "}
                          {data.settings.bonus_percent}% doanh số. Chưa phê
                          duyệt.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                          <button
                            className="secondary full"
                            onClick={() => {
                              setEditing(m);
                              setModal("member");
                            }}
                          >
                            Thông tin nhân viên
                            <ChevronRight size={15} />
                          </button>
                          {m.id !== data.user.id && (
                            <button
                              className="danger-button full"
                              disabled={busy}
                              onClick={() =>
                                setDialog({
                                  title: "Xóa nhân viên",
                                  message: `Bạn có chắc chắn muốn xóa ${m.name}? Hành động này không thể hoàn tác. Toàn bộ dữ liệu đăng nhập và PIN của nhân viên này sẽ bị xóa vĩnh viễn.`,
                                  actionLabel: "Xóa vĩnh viễn",
                                  action: async () => {
                                    setBusy(true);
                                    setError("");
                                    try {
                                      const res = await request("staff/delete", { id: m.id });
                                      await reload();
                                      setNotice(`Đã xóa nhân viên ${res.name ?? m.name}.`);
                                    } catch (e) {
                                      setError((e as Error).message);
                                    } finally {
                                      setBusy(false);
                                    }
                                  },
                                })
                              }
                            >
                              <Trash2 size={15} />
                              Xóa nhân viên
                            </button>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
              {path === "/finance" && (
                <>
                  <div className="grid-3">
                    <Stat
                      label="Tổng doanh thu đã ghi nhận"
                      value={sales.reduce((s, o) => s + o.total, 0)}
                      detail="Đơn hàng hoàn thành"
                    />
                    <Stat
                      label="Chi phí vận hành"
                      value={data.expenses.reduce((s, e) => s + e.amount, 0)}
                      detail="Các khoản chi đã ghi nhận"
                    />
                    <Stat
                      label="Ca chờ duyệt"
                      value={data.shifts.filter((s) => s.status === "submitted").length}
                      detail="Đối soát tiền mặt"
                      formatOptions={{ style: "decimal" }}
                    />
                  </div>
                  <ShiftTable
                    data={data}
                    onApprove={(id) =>
                      mutate({ type: "approve_shift", payload: { id } })
                    }
                  />
                  <section className="panel">
                    <div className="section-toolbar">
                      <h2>Chi phí vận hành</h2>
                    </div>
                    {data.expenses.length ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Nội dung</th>
                              <th>Danh mục</th>
                              <th>Thời gian</th>
                              <th className="right">Số tiền</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.expenses.map((e) => (
                              <tr key={e.id}>
                                <td data-label="Nội dung">{e.note}</td>
                                <td data-label="Danh mục">{e.category}</td>
                                <td data-label="Thời gian">{date(e.created_at)}</td>
                                <td className="right money" data-label="Số tiền">
                                  {money(e.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty
                        title="Chưa có khoản chi"
                        detail="Ghi nhận tiền thuê, điện nước và các chi phí vận hành."
                        action={
                          <button
                            className="secondary"
                            onClick={() => setModal("expense")}
                          >
                            Ghi khoản chi đầu tiên
                          </button>
                        }
                      />
                    )}
                  </section>
                </>
              )}
              {path === "/reports" && <Reports data={data} />}
              {admin && path.startsWith("/admin") && (
                <OperationsPanel
                  data={data}
                  path={path}
                  onSave={mutate}
                  onReload={reload}
                />
              )}
              {path === "/admin/settings" && (
                <SettingsForm
                  data={data}
                  busy={busy}
                  onSave={(payload) => mutate({ type: "settings", payload })}
                />
              )}
              {path === "/profile" && (
                <section className="panel" style={{ maxWidth: 500, margin: "0 auto", textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
                    <span className="avatar" style={{ background: data.user.color, width: 80, height: 80, fontSize: 32, margin: "0 auto" }}>
                      {data.user.name.split(" ").at(-1)?.[0]}
                    </span>
                    <h2 style={{ margin: 0 }}>{data.user.name}</h2>
                    <span className="badge">{admin ? "Quản lý" : "Nhân viên"}</span>
                  </div>

                  <div className="form-grid" style={{ marginTop: 40, textAlign: "left", gridTemplateColumns: "1fr" }}>
                    <Field label="Tên hiển thị">
                      <input defaultValue={data.user.name} readOnly disabled />
                    </Field>
                    <Field label="Mã số nhân viên">
                      <input defaultValue={data.user.id.split("-")[0]} readOnly disabled />
                    </Field>
                  </div>

                  {/* Notification permission card */}
                  {notifPerm !== "unsupported" && (
                    <div className="notif-profile-card">
                      <div className="notif-profile-icon">
                        {notifPerm === "granted" ? (
                          <Bell size={22} style={{ color: "var(--success)" }} />
                        ) : notifPerm === "denied" ? (
                          <BellOff size={22} style={{ color: "var(--danger)" }} />
                        ) : (
                          <Bell size={22} style={{ color: "var(--accent)" }} />
                        )}
                      </div>
                      <div className="notif-profile-body">
                        <strong>
                          {notifPerm === "granted"
                            ? "Thông báo đã bật"
                            : notifPerm === "denied"
                              ? "Thông báo bị chặn"
                              : "Bật thông báo"}
                        </strong>
                        <p>
                          {notifPerm === "granted"
                            ? "Bạn sẽ nhận thông báo cho mỗi giao dịch quan trọng."
                            : notifPerm === "denied"
                              ? "Hãy vào Cài đặt trình duyệt → Quyền để bật lại."
                              : "Nhận thông báo tức thì cho mỗi đơn hàng, ca làm và đồng bộ dữ liệu."}
                        </p>
                      </div>
                      {notifPerm !== "granted" && notifPerm !== "denied" && (
                        <button
                          className="primary"
                          style={{ flexShrink: 0 }}
                          onClick={handleRequestNotif}
                        >
                          Bật
                        </button>
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "10px", marginTop: "24px", flexWrap: "wrap" }}>
                    <button className="secondary" style={{ flex: "1 1 140px" }} onClick={() => setModal("change-pin")}>
                      Đổi mã PIN
                    </button>
                    <button className="primary" style={{ flex: "1 1 140px", background: "var(--danger)", color: "white", borderColor: "var(--danger)" }} onClick={switchProfile}>
                      <LogOut size={16} style={{ marginRight: 6 }} /> Đăng xuất
                    </button>
                  </div>
                </section>
              )}
              {!titles[path] && (
                <Empty
                  title="Trang không tồn tại"
                  detail="Chọn một mục trong thanh điều hướng để tiếp tục."
                />
              )}
            </>
          )}
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {receipt && (
        <Modal title="Chi tiết đơn hàng" close={() => setReceipt(null)}>
          
          <div className="order-details">
            <div className="order-details-header">
              <div className="order-details-meta">
                <h3 style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 400, color: "var(--muted)" }}>Đơn hàng</span>
                  {receipt.number}
                </h3>
                <p>{date(receipt.created_at)}</p>
                {receipt.sync && <p className="sync-warn">ĐÃ LƯU TRÊN THIẾT BỊ · CHỜ MÁY CHỦ XÁC NHẬN</p>}
                {receipt.status === "cancelled" && <p className="cancel-warn">ĐÃ HỦY · {receipt.reason}</p>}
              </div>
              <div className="order-details-status">
                <span className={"badge " + (receipt.status === "cancelled" ? "danger" : "success")}>
                  {receipt.status === "cancelled" ? "Đã hủy" : "Hoàn thành"}
                </span>
              </div>
            </div>

            <div className="order-details-items">
              {receipt.lines.map((l) => (
                <div className="order-item-row" key={l.product_id} style={{ alignItems: "flex-start" }}>
                  <div className="order-item-info">
                    <strong style={{ fontSize: 15, marginBottom: 2 }}>{l.name}</strong>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 13 }}>
                      {l.variant && <span>{l.variant}</span>}
                      {l.variant && <span>·</span>}
                      <span style={{ fontWeight: 500, color: "var(--fg)" }}>x{l.quantity}</span>
                    </div>
                  </div>
                  <div className="order-item-price" style={{ paddingTop: 2 }}>
                    {money(l.price * l.quantity)}
                  </div>
                </div>
              ))}
            </div>

            <div className="order-details-summary">
              {receipt.discount > 0 && (
                <div className="order-summary-row">
                  <span>Giảm giá</span>
                  <span style={{ color: "var(--danger)" }}>-{money(receipt.discount)}</span>
                </div>
              )}
              
              <div className="order-summary-row" style={{ alignItems: "center" }}>
                <span>Người bán</span>
                {admin ? (
                  <select 
                    className="input"
                    style={{ padding: '6px 12px', fontSize: 14, minWidth: 140, margin: 0, height: 32 }}
                    value={receipt.user_id}
                    disabled={busy}
                    onChange={async (e) => {
                      const newUserId = e.target.value;
                      const ok = await mutate({
                        type: "order_assign",
                        payload: { id: receipt.id, user_id: newUserId }
                      });
                      if (ok) {
                        setReceipt(prev => prev ? { ...prev, user_id: newUserId } : prev);
                      }
                    }}
                  >
                    {data.members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="badge"><UserCircle size={14} style={{ display: "inline-block", verticalAlign: "text-bottom", marginRight: 4 }}/>{data.members.find(m => m.id === receipt.user_id)?.name || "N/A"}</span>
                )}
              </div>
              
              <div style={{ borderTop: "1px dashed var(--border)", marginTop: 8, paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 500, color: "var(--fg)" }}>Chi tiết thanh toán</span>
                  {admin && (
                    <button 
                      className="secondary" 
                      style={{ padding: "4px 12px", fontSize: 12, height: "auto" }}
                      onClick={() => {
                        setEditCash(receipt.cash.toString());
                        setEditTransfer(receipt.transfer.toString());
                        setEditCard(receipt.card.toString());
                        setEditPayment(receipt);
                      }}
                    >
                      Sửa
                    </button>
                  )}
                </div>
                
                <div className="order-summary-row">
                  <span>Phương thức</span>
                  <span className="badge" style={{ background: "color-mix(in srgb, var(--text) 8%, transparent)", color: "var(--text)" }}>
                    <CreditCard size={14} style={{ display: "inline-block", verticalAlign: "text-bottom", marginRight: 4 }} />
                    {paymentNames[receipt.payment_method]}
                  </span>
                </div>
                
                {(receipt.cash > 0 || receipt.transfer > 0 || receipt.card > 0) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {receipt.cash > 0 && (
                      <div className="order-summary-row">
                        <span>Tiền mặt</span>
                        <strong>{money(receipt.cash)}</strong>
                      </div>
                    )}
                    {receipt.transfer > 0 && (
                      <div className="order-summary-row">
                        <span>Chuyển khoản</span>
                        <strong>{money(receipt.transfer)}</strong>
                      </div>
                    )}
                    {receipt.card > 0 && (
                      <div className="order-summary-row">
                        <span>Quẹt thẻ</span>
                        <strong>{money(receipt.card)}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {receipt.note && (
                <div className="order-summary-row">
                  <span>Ghi chú</span>
                  <span style={{ textAlign: "right", maxWidth: "65%" }}>{receipt.note}</span>
                </div>
              )}
              
              <div className="order-summary-row total">
                <span>Tổng thanh toán</span>
                <span style={{ color: "var(--accent-bright)" }}>{money(receipt.total)}</span>
              </div>
            </div>
          </div>

          {/* Printable receipt (hidden on screen) */}
          <div className="receipt" id="receipt">
            <div className="receipt-header">
              <h2>{data.settings.name}</h2>
              <p>{data.settings.address}</p>
              <p>{data.settings.phone}</p>
            </div>
            <div className="receipt-divider" />
            <div className="receipt-meta">
              <h3>{receipt.number}</h3>
              {receipt.sync && <p className="sync-warn">ĐÃ LƯU TRÊN THIẾT BỊ · CHỜ MÁY CHỦ XÁC NHẬN</p>}
              <p>{date(receipt.created_at)}</p>
              {receipt.status === "cancelled" && <p className="cancel-warn">ĐÃ HỦY · {receipt.reason}</p>}
            </div>
            {receipt.lines.map((l) => (
              <div className="receipt-line" key={l.product_id}>
                <span>
                  {l.name}
                  <small>
                    {l.variant} · x{l.quantity}
                  </small>
                </span>
                <strong>{money(l.price * l.quantity)}</strong>
              </div>
            ))}
            <div className="receipt-divider" />
            {receipt.discount > 0 && (
              <div className="summary-row">
                <span>Giảm giá</span>
                <span>-{money(receipt.discount)}</span>
              </div>
            )}
            <div className="total-row">
              <strong>Tổng cộng</strong>
              <strong>{money(receipt.total)}</strong>
            </div>
            <div className="summary-row">
              <span>Nhân viên</span>
              <span>{data.members.find(m => m.id === receipt.user_id)?.name || "N/A"}</span>
            </div>
            <div className="summary-row">
              <span>Phương thức thanh toán</span>
              <span>{paymentNames[receipt.payment_method]}</span>
            </div>
            {receipt.cash > 0 && (
              <div className="summary-row">
                <span>Tiền mặt</span>
                <span>{money(receipt.cash)}</span>
              </div>
            )}
            {receipt.transfer > 0 && (
              <div className="summary-row">
                <span>Chuyển khoản</span>
                <span>{money(receipt.transfer)}</span>
              </div>
            )}
            {receipt.card > 0 && (
              <div className="summary-row">
                <span>Quẹt thẻ</span>
                <span>{money(receipt.card)}</span>
              </div>
            )}
            {receipt.note && (
              <div className="summary-row">
                <span>Ghi chú:</span>
                <span>{receipt.note}</span>
              </div>
            )}
            <div className="receipt-divider" />
            <p className="receipt-footer">{data.settings.receipt_footer}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "row", flexWrap: "nowrap", gap: 8, marginTop: 24 }}>
            <button className="secondary" onClick={() => setReceipt(null)} style={{ flex: 1, justifyContent: "center", padding: "10px 4px" }}>
              Quay về
            </button>
            <button className="secondary" onClick={() => window.print()} style={{ flex: 1, justifyContent: "center", padding: "10px 4px" }}>
              <Printer size={17} />
              <span className="hide-on-mobile" style={{ marginLeft: 6 }}>In bill</span>
            </button>
            {receipt.status === "completed" &&
              (admin || data.settings.allow_staff_cancel) && (
                <button
                  className="danger-button"
                  style={{ flex: 1, justifyContent: "center", padding: "10px 4px" }}
                  disabled={busy}
                  onClick={() => {
                    setReceipt(null);
                    setCancelingOrder(receipt);
                  }}
                >
                  Hủy đơn
                </button>
              )}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}

      {editPayment && (
        <Modal title="Sửa thanh toán đơn hàng" close={() => setEditPayment(null)}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ marginBottom: 12 }}>Tổng thanh toán cần khớp: <strong style={{ color: "var(--accent-bright)" }}>{money(editPayment.total)}</strong></p>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "var(--muted)" }}>Tiền mặt</label>
                <SmartMoneyInput type="number" className="input" style={{ width: "100%" }} value={editCash} onValueChange={setEditCash} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "var(--muted)" }}>Chuyển khoản</label>
                <SmartMoneyInput type="number" className="input" style={{ width: "100%" }} value={editTransfer} onValueChange={setEditTransfer} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "var(--muted)" }}>Quẹt thẻ</label>
                <SmartMoneyInput type="number" className="input" style={{ width: "100%" }} value={editCard} onValueChange={setEditCard} />
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setEditPayment(null)}>Hủy</button>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                const c = parseInt(editCash) || 0;
                const t = parseInt(editTransfer) || 0;
                const cd = parseInt(editCard) || 0;
                if (c + t + cd !== editPayment.total) {
                  alert("Tổng số tiền nhập vào không khớp với tổng đơn hàng!");
                  return;
                }
                const ok = await mutate({
                  type: "edit_order_payment",
                  payload: {
                    id: editPayment.id,
                    cash: c,
                    transfer: t,
                    card: cd
                  }
                });
                if (ok) {
                  setEditPayment(null);
                  setReceipt(prev => prev ? { ...prev, cash: c, transfer: t, card: cd } : prev);
                }
              }}
            >
              Lưu thay đổi
            </button>
          </div>
        </Modal>
      )}

      {cancelingOrder && (
        <Modal
          title="Hủy đơn hàng"
          close={() => setCancelingOrder(null)}
        >
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const reason = formData.get("reason") as string;
              if (!reason.trim()) return;
              if (
                await mutate({
                  type: "cancel",
                  payload: { id: cancelingOrder.id, reason },
                })
              ) {
                setCancelingOrder(null);
              }
            }}
          >
            <p style={{ lineHeight: 1.5 }}>
              Bạn đang hủy đơn hàng <strong>{cancelingOrder.number}</strong>.<br />
              Thao tác này sẽ hoàn lại số lượng tồn kho và gạch bỏ doanh thu.
            </p>
            <div className="form-group">
              <label>Lý do hủy đơn (bắt buộc)</label>
              <input name="reason" required autoFocus placeholder="VD: Khách đổi ý, Nhập sai món..." />
            </div>
            <div className="modal-actions">
              <button className="secondary" type="button" onClick={() => setCancelingOrder(null)}>
                Quay lại
              </button>
              <button className="danger-button" type="submit" disabled={busy}>
                Xác nhận Hủy đơn
              </button>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </form>
        </Modal>
      )}
      {modal && modal !== "queue" && modal !== "qr" && (
        <Modal
          title={
            {
              product: editing ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm",
              stock: "Điều chỉnh tồn kho",
              expense: "Ghi nhận chi phí",
              member: editing ? "Thông tin nhân viên" : "Thêm nhân viên",
              "shift-open": "Bắt đầu ca làm",
              "shift-close": "Kết ca & đối soát",
              "change-pin": "Đổi mã PIN",
            }[modal]
          }
          close={() => {
            setModal(null);
            setError("");
          }}
        >
          <form onSubmit={submitForm} className="stack-form">
            {modal === "change-pin" && (
              <>
                <Field label="Mã PIN hiện tại">
                  <input name="old_pin" type="password" required pattern="[0-9]{4,6}" placeholder="Nhập PIN cũ" />
                </Field>
                <Field label="Mã PIN mới (4-6 số)">
                  <input name="new_pin" type="password" required pattern="[0-9]{4,6}" placeholder="Nhập PIN mới" />
                </Field>
              </>
            )}
            {modal === "product" && (
              <ProductFields product={editing as Product | null} />
            )}{" "}
            {modal === "stock" && (
              <>
                <p>
                  {(editing as Product)?.name} · Còn{" "}
                  {(editing as Product)?.stock}
                </p>
                <Field label="Thay đổi số lượng (âm để giảm)">
                  <input name="quantity" type="number" required step="1" />
                </Field>
                <Field label="Lý do">
                  <input name="reason" required maxLength={200} />
                </Field>
              </>
            )}
            {modal === "expense" && (
              <>
                <Field label="Số tiền (₫)">
                  <SmartMoneyInput name="amount" type="number" min="1" required />
                </Field>
                <Field label="Danh mục">
                  <select name="category">
                    {[
                      "Mặt bằng",
                      "Điện nước",
                      "Vận chuyển",
                      "Vật tư",
                      "Khác",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Nội dung">
                  <input name="note" required maxLength={200} />
                </Field>
              </>
            )}
            {modal === "member" && (
              <>
                <Field label="Tên hiển thị">
                  <input
                    name="name"
                    required
                    defaultValue={(editing as Member)?.name}
                  />
                </Field>
                <Field label="Lương theo giờ (₫)">
                  <SmartMoneyInput
                    name="hourly_rate"
                    type="number"
                    min="0"
                    required
                    defaultValue={(editing as Member)?.hourly_rate || 25000}
                  />
                </Field>
                <Field label="Vai trò">
                  <select
                    name="role"
                    defaultValue={(editing as Member)?.role || "staff"}
                  >
                    <option value="staff">Nhân viên</option>
                    <option value="admin">Quản lý</option>
                  </select>
                </Field>
                {!editing && (
                  <>
                    <Field label="Mã PIN (4 đến 6 số)">
                      <input
                        name="pin"
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]{4,6}"
                        autoComplete="new-password"
                        required={!isDemo()}
                      />
                    </Field>
                  </>
                )}
              </>
            )}
            {modal === "shift-open" && (
              <>
                <p className="form-hint">
                  Thời gian chấm công sẽ được ghi nhận khi bắt đầu ca.
                </p>
                <Field label="Tiền mặt đầu ca (₫)">
                  <SmartMoneyInput
                    name="opening_cash"
                    type="number"
                    min="0"
                    required
                    defaultValue="0"
                  />
                </Field>
              </>
            )}
            {modal === "shift-close" && (
              <>
                <div className="summary-row">
                  <span>Tiền mặt dự kiến</span>
                  <strong>
                    {money(current ? expectedCash(current, data.orders) : 0)}
                  </strong>
                </div>
                <Field label="Tiền mặt kiểm đếm thực tế (₫)">
                  <SmartMoneyInput name="actual_cash" type="number" min="0" required />
                </Field>
                <Field label="Ghi chú đối soát">
                  <textarea
                    name="note"
                    placeholder="Bắt buộc nếu có chênh lệch"
                  />
                </Field>
                {queue.length > 0 && (
                  <p className="form-error">
                    Đồng bộ hết đơn hàng trước khi kết ca.
                  </p>
                )}
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary full"
              disabled={busy || (modal === "shift-close" && queue.length > 0)}
            >
              {busy ? "Đang lưu…" : "Lưu & hoàn tất"}
              <Check size={17} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "queue" && (
        <Modal title="Trạng thái đồng bộ" close={() => setModal(null)}>
          {queue.length ? (
            queue
              .filter((q) => q.actor_id === data.user.id)
              .map((q) => (
                <div key={q.id} className="queue-item">
                  <strong>
                    {money(
                      q.payload.cash + q.payload.transfer + q.payload.card,
                    )}
                  </strong>
                  <p>{q.error || "Đã lưu trên thiết bị, chờ kết nối."}</p>
                  <button
                    className="secondary"
                    onClick={async () => {
                      await retryPending(q.id);
                      await syncQueue(data);
                      await reload();
                    }}
                  >
                    <RefreshCw size={15} />
                    Thử lại
                  </button>
                </div>
              ))
          ) : (
            <Empty
              title="Tất cả dữ liệu an toàn"
              detail="Tất cả giao dịch đã được đồng bộ với máy chủ."
            />
          )}
        </Modal>
      )}
      {dialog && (
        <Modal title={dialog.title} close={() => setDialog(null)}>
          <p style={{ marginTop: 0 }}>{dialog.message}</p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setDialog(null)}>
              Hủy
            </button>
            <button className="primary" style={{ background: "var(--danger)", borderColor: "var(--danger)", color: "white" }} onClick={() => {
              dialog.action();
              setDialog(null);
            }}>
              {dialog.actionLabel}
            </button>
          </div>
        </Modal>
      )}

      {modal === "qr" && (
        <Modal title="Thanh toán chuyển khoản" close={() => setModal(null)}>
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <img 
              src="/qr-code-transfer.jpg" 
              alt="QR Code Chuyển khoản" 
              style={{ width: "100%", maxWidth: "340px", borderRadius: "12px", border: "1px solid var(--border)", margin: "0 auto", display: "block" }} 
            />
            <p style={{ marginTop: 24, fontSize: 14, color: "var(--text)" }}>Vui lòng kiểm tra kỹ giao dịch trước khi xác nhận đơn hàng.</p>
            <button className="primary" onClick={() => setModal(null)} style={{ marginTop: 20, width: "100%", minHeight: 48, fontSize: 16 }}>
              Đã nhận được tiền
            </button>
          </div>
        </Modal>
      )}

      {!receipt && lines.length > 0 && (
        <style dangerouslySetInnerHTML={{ __html: `
          @media screen {
            #pre-bill { display: none !important; }
          }
          @media print {
            #pre-bill { display: block !important; }
            #receipt { display: none !important; }
          }
        `}} />
      )}
      {!receipt && lines.length > 0 && (
        <div className="receipt" id="pre-bill">
          <div className="receipt-header">
            <h2>{data?.settings.name}</h2>
            <p>{data?.settings.address}</p>
            <p>{data?.settings.phone}</p>
          </div>
          <div className="receipt-divider" />
          <div className="receipt-meta">
            <h3>PHIẾU TẠM TÍNH</h3>
            <p>{date(new Date().toISOString())}</p>
          </div>
          {lines.map((l) => (
            <div className="receipt-line" key={l.product.id}>
              <span>
                {l.product.name}
                <small>
                  {l.product.variant} · x{l.quantity}
                </small>
              </span>
              <strong>{money(l.product.price * l.quantity)}</strong>
            </div>
          ))}
          <hr />
          {discountVal > 0 && (
            <div className="summary-row">
              <span>Giảm giá</span>
              <span>-{money(discountVal)}</span>
            </div>
          )}
          <div className="total-row">
            <strong>Tổng cộng</strong>
            <strong>{money(total)}</strong>
          </div>
          <div className="summary-row">
            <span>Thanh toán dự kiến</span>
            <span>{method === "cash" ? "Tiền mặt" : method === "card" ? "Quẹt thẻ" : "Chuyển khoản"}</span>
          </div>
          {note && (
            <div className="summary-row">
              <span>Ghi chú:</span>
              <span>{note}</span>
            </div>
          )}
          <hr />
          <p>Phiếu tạm tính chưa phải là hóa đơn chính thức.</p>
        </div>
      )}
    </div>
  );
}


function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function SettingsForm({
  data,
  busy,
  onSave,
}: {
  data: Snapshot;
  busy: boolean;
  onSave: (p: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid-layout">
      <form
        className="panel settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave({
            name: f.get("name"),
            address: f.get("address"),
            phone: f.get("phone"),
            receipt_footer: f.get("receipt_footer"),
            bonus_percent: Number(f.get("bonus_percent")),
            theme: f.get("theme"),
            allow_staff_cancel: f.get("allow_staff_cancel") === "on",
          });
        }}
      >
        <h2>Thông tin cửa hàng</h2>
        <p className="muted">Hiển thị trên không gian làm việc và hóa đơn.</p>
        <Field label="Tên cửa hàng">
          <input name="name" defaultValue={data.settings.name} required />
        </Field>
        <Field label="Địa chỉ">
          <input name="address" defaultValue={data.settings.address} />
        </Field>
        <Field label="Số điện thoại">
          <input name="phone" defaultValue={data.settings.phone} />
        </Field>
        <Field label="Lời nhắn trên hóa đơn">
          <textarea
            name="receipt_footer"
            defaultValue={data.settings.receipt_footer}
          />
        </Field>
        <hr />
        <h2>Vận hành & bảo mật</h2>
        <div className="form-grid">
          <Field label="Thưởng doanh số (%)">
            <input
              name="bonus_percent"
              type="number"
              min="0"
              max="100"
              step="0.1"
              defaultValue={data.settings.bonus_percent}
            />
          </Field>
        </div>
        <Field label="Giao diện mặc định">
          <select name="theme" defaultValue={data.settings.theme}>
            <option value="dark">Tối</option>
            <option value="light">Sáng</option>
          </select>
        </Field>
        <label className="checkbox-label">
          <input
            name="allow_staff_cancel"
            type="checkbox"
            defaultChecked={data.settings.allow_staff_cancel}
          />
          Cho phép nhân viên tự hủy đơn kèm lý do
        </label>
        <button
          className="primary"
          disabled={busy}
          data-state={busy ? "loading" : undefined}
        >
          {busy ? "Đang lưu…" : "Lưu cài đặt"}
        </button>
      </form>
      <div>
        <section className="panel settings-aside">
          <Download size={24} />
          <h2>Xuất dữ liệu</h2>
          <p>
            Bản xuất JSON chứa dữ liệu hiện có trong không gian này. Đây không
            thay thế bản sao lưu cơ sở dữ liệu.
          </p>
          <button
            className="secondary"
            onClick={() =>
              download(
                "insideout-export-" +
                  new Date().toISOString().slice(0, 10) +
                  ".json",
                data,
              )
            }
          >
            Tải bản xuất
            <Download size={16} />
          </button>
        </section>
        <section className="panel settings-aside">
          <ShieldCheck size={24} />
          <h2>Nhật ký thao tác</h2>
          {data.audit.slice(0, 8).map((a) => (
            <div className="list-row small-text" style={{ color: "var(--muted)" }} key={a.id}>
              <strong>{a.action}</strong>
              <span>{date(a.created_at)}</span>
            </div>
          ))}
          {!data.audit.length && <p>Chưa có thao tác được ghi nhận.</p>}
        </section>
      </div>
    </div>
  );
}

function PinPad({ pin, setPin, busy, onConfirm }: { pin: string, setPin: (p: string) => void, busy: boolean, onConfirm?: () => void }) {
  return (
    <div className="pin-area" style={{ padding: 0 }}>
      <div className="pin-dots" aria-label={pin.length + " số đã nhập"} style={{ marginBottom: 16 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={i < pin.length ? "filled" : ""} />
        ))}
      </div>
      <input
        className="sr-only"
        name="pin"
        aria-label="Mã PIN"
        inputMode="numeric"
        type="password"
        value={pin}
        autoFocus
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && pin.length >= 4 && onConfirm && !busy) {
            e.preventDefault();
            onConfirm();
          }
        }}
      />
      <div className="pin-pad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "✓"].map((key) => (
          <button
            type={key === "✓" && !onConfirm ? "submit" : "button"}
            key={key}
            disabled={busy}
            aria-label={key === "←" ? "Xóa số" : key === "✓" ? "Xác nhận PIN" : key}
            onClick={() => {
              if (key === "←") setPin(pin.slice(0, -1));
              else if (key === "✓") {
                if (onConfirm && pin.length >= 4) onConfirm();
              } else if (pin.length < 6) setPin(pin + key);
            }}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [list, setList] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [regName, setRegName] = useState("");
  
  const loadProfiles = () => {
    setLoadingProfiles(true);
    profiles()
      .then(setList)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingProfiles(false));
  };
  
  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      if (mounted) loadProfiles();
    });
    return () => {
      mounted = false;
    };
  }, []);
  async function enterPin(value: string) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      if (isDemo()) await demoLogin(selected.id);
      else {
        await request("auth/pin", { id: selected.id, pin: value });
      }
      snapshot().catch(console.error); // Prefetch state in background
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  async function registerAccount() {
    if (!regName.trim() || pin.length < 4) return;
    setBusy(true);
    setError("");
    try {
      await request("auth/register", { name: regName, pin });
      setMode("login");
      setRegName("");
      setPin("");
      loadProfiles();
    } catch (e) {
      setError((e as Error).message);
      setPin("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <Link href="/login" className="brand">
        <div className="brand-symbol">InsideOut</div>
        <div>
          <span>v1.0.2</span>
        </div>
      </Link>
      <section
        className={
          "login-content profiles-content"
        }
      >
        <div className="eyebrow">MỘT KHÔNG GIAN. CÙNG NHAU VẬN HÀNH.</div>
        <h1>
          {selected
            ? "Chào " + selected.name.split(" ").at(-1) + "."
            : "Ai đang làm việc?"}
        </h1>
        <p>
          {selected
            ? "Nhập mã PIN để đăng nhập."
            : "Chọn hồ sơ được lưu trong cửa hàng rồi nhập PIN."}
        </p>
        {mode === "register" ? (
          <div className="pin-area">
            <Field label="Tên hiển thị">
              <input
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                disabled={busy}
                placeholder="Nhập tên của bạn"
                maxLength={50}
                style={{ marginBottom: "16px" }}
              />
            </Field>
            <p>Tạo mã PIN (4-6 số)</p>
            <PinPad pin={pin} setPin={setPin} busy={busy || !regName.trim()} onConfirm={registerAccount} />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="text-button"
              onClick={() => {
                setMode("login");
                setPin("");
                setError("");
              }}
            >
              <ArrowLeft size={15} />
              Quay lại đăng nhập
            </button>
          </div>
        ) : selected ? (
          <div className="pin-area">

            <PinPad pin={pin} setPin={setPin} busy={busy} onConfirm={() => enterPin(pin)} />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="text-button"
              onClick={() => {
                setSelected(null);
                setPin("");
                setError("");
              }}
            >
              <ArrowLeft size={15} />
              Chọn hồ sơ khác
            </button>
          </div>
        ) : (
          <>
            {loadingProfiles ? (
              <div className="skeleton" aria-label="Đang tải hồ sơ" />
            ) : (
              <div className="profile-grid">
                {list.filter((m) => m.active).map((m) => (
                  <button
                    className="profile-card"
                    key={m.id}
                    onClick={() => setSelected(m)}
                  >
                    <div style={{ background: m.color }}>
                      <span>{m.name.split(" ").at(-1)?.[0]}</span>
                      <LockKeyhole size={17} />
                    </div>
                    <strong>{m.name}</strong>
                    <small>
                      {m.role === "admin" ? "Quản lý" : "Nhân viên"}
                    </small>
                  </button>
                ))}
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {!loadingProfiles && !error && list.length === 0 && (
              <p className="form-hint">Cửa hàng chưa có hồ sơ hoạt động.</p>
            )}
            {!loadingProfiles && (
              <button
                className="text-button"
                style={{ marginTop: 24, justifyContent: "center", width: "100%" }}
                onClick={() => {
                  setMode("register");
                  setPin("");
                  setError("");
                }}
              >
                <Plus size={15} />
                Đăng ký tài khoản nhân viên
              </button>
            )}
          </>
        )}
      </section>
      <footer>inside out · Những điều tốt đẹp bắt đầu từ bên trong.</footer>
    </main>
  );
}
