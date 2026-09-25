"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import Image from "next/image";
const OperationsPanel = dynamic(() => import("./operations-panel"), {
  loading: () => <div className="skeleton" aria-label="Đang tải" />,
});
const Reports = dynamic(() => import("./reports"), {
  loading: () => <div className="skeleton" aria-label="Đang tải báo cáo" />,
});
import {
  ArrowUpRight,
  ArrowLeft,
  Check,
  ChevronDown,
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
  Package,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShoppingBag,
  SlidersHorizontal,
  Sun,
  Moon,
  Trash2,
  Users,
  Wallet,
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
import { businessDay, date, expectedCash, money, payroll } from "@/lib/domain";
import { seed } from "@/lib/demo";
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

const navigation = [
  { href: "/pos", label: "Bán hàng", icon: ShoppingBag },
  { href: "/orders", label: "Đơn hàng", icon: History },
  { href: "/shift", label: "Ca làm việc", icon: Clock },
  { href: "/reports", label: "Tổng quan", icon: LayoutDashboard, admin: true },
  { href: "/admin/products", label: "Sản phẩm", icon: Package, admin: true },
  { href: "/admin/staff", label: "Nhân sự", icon: Users, admin: true },
  { href: "/finance", label: "Thu chi", icon: Wallet, admin: true },
  {
    href: "/admin/settings",
    label: "Cài đặt",
    icon: SettingsIcon,
    admin: true,
  },
];
navigation.splice(
  6,
  0,
  { href: "/admin/payroll", label: "Bảng lương", icon: Wallet, admin: true },
  { href: "/admin/attendance", label: "Chấm công", icon: Clock, admin: true },
);
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
};
function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <ShoppingBag size={30} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="modal"
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <IconButton label="Đóng" onClick={close}>
          <X size={20} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
function ProductArt({
  product,
  small = false,
}: {
  product: Product;
  small?: boolean;
}) {
  if (product.image_url)
    return (
      <div className={"product-art " + (small ? "small" : "")}>
        <Image
          src={product.image_url}
          alt={product.name}
          width={small ? 50 : 400}
          height={small ? 55 : 400}
          unoptimized
          sizes={small ? "50px" : "(max-width:700px) 45vw, 240px"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );
  return (
    <div
      className={"product-art " + (small ? "small" : "")}
      style={{ "--garment": product.color } as React.CSSProperties}
    >
      <svg viewBox="0 0 220 200" aria-hidden="true">
        <ellipse cx="110" cy="178" rx="58" ry="7" fill="black" opacity=".09" />
        {product.kind === "pants" ? (
          <g fill="var(--garment)" stroke="#000" strokeOpacity=".15">
            <path d="M72 29h76l8 143-39 1-8-92-9 92-39-1z" />
            <path
              d="M73 51h73M109 33v48M66 96h29v30H64M124 96h28v30h-26"
              fill="none"
            />
          </g>
        ) : product.kind === "bag" ? (
          <g stroke="#000" strokeOpacity=".2">
            <path
              d="M85 61V44c0-34 50-34 50 0v17"
              fill="none"
              stroke="var(--garment)"
              strokeWidth="12"
            />
            <path d="M61 59h98l11 112H50z" fill="var(--garment)" />
            <text
              x="110"
              y="121"
              textAnchor="middle"
              fill="#484740"
              fontSize="10"
              fontWeight="700"
              stroke="none"
            >
              inside out.
            </text>
          </g>
        ) : product.kind === "cap" ? (
          <g fill="var(--garment)">
            <path d="M56 123c0-97 108-97 108 0z" />
            <path d="M53 117c-5 15 37 46 102 29 41-12 18-31-10-28z" />
            <path
              d="M108 53v59M74 116c0-37 13-63 34-63"
              stroke="#fff"
              strokeOpacity=".1"
              fill="none"
            />
            <text x="110" y="104" textAnchor="middle" fill="#ddd" fontSize="11">
              io.
            </text>
          </g>
        ) : (
          <g fill="var(--garment)" stroke="#000" strokeOpacity=".13">
            <path
              d={
                product.kind === "hoodie"
                  ? "M82 49Q79 13 110 13Q141 13 138 49L160 55 192 141 164 154 144 99 148 174H72L76 99 56 154 28 141 60 55Z"
                  : "M82 40Q110 58 138 40L168 52 194 91 162 110 145 87 148 172H72L75 87 58 110 26 91 52 52Z"
              }
            />
            <path
              d={
                product.kind === "hoodie"
                  ? "M88 45Q110 69 132 45M85 136h50l8 22H77z"
                  : "M85 44Q110 75 135 44"
              }
              fill="none"
              strokeWidth="3"
            />
            <path
              d="M78 97l4 63M140 97l-4 63"
              stroke="#fff"
              strokeOpacity=".08"
            />
            <text
              x="110"
              y="99"
              textAnchor="middle"
              fill={product.color === "#303333" ? "#c1c1b8" : "#55564e"}
              fontSize="7"
              fontWeight="600"
              stroke="none"
            >
              inside out.
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

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
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [payment, setPayment] = useState(false);
  const [cash, setCash] = useState("");
  const [method, setMethod] = useState("cash");
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [modal, setModal] = useState<
    | "product"
    | "stock"
    | "expense"
    | "member"
    | "shift-open"
    | "shift-close"
    | "queue"
    | null
  >(null);
  const [editing, setEditing] = useState<Product | Member | null>(null);
  const [mobileCart, setMobileCart] = useState(false);

  const [, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
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
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!data || !online) return;
    const run = async () => {
      try {
        const before = (await pending()).length;
        await syncQueue(data);
        const after = await pending();
        setQueue(after);
        if (after.length < before) {
          const fresh = await snapshot();
          setData(fresh);
        }
      } catch {
        /* A locked or disconnected session keeps its durable outbox. */
      }
    };
    const synced = (event: MessageEvent) => {
      if (event.data?.type === "OUTBOX_SYNCED") {
        snapshot()
          .then(setData)
          .catch(() => {});
        pending()
          .then(setQueue)
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
  }, [data, online]);
  useEffect(() => {
    if (!data) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        lock().finally(() => {
          setData(null);
          setCart({});
          router.push("/profiles");
        });
      }, data.settings.idle_minutes * 60000);
    };
    reset();
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [data, router]);
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
    router.push("/profiles");
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
  const current = data.shifts.find(
    (s) => s.user_id === data.user.id && s.status === "open",
  );
  const isProducts = ["/admin/products", "/admin/inventory"].includes(path);
  const isShift = ["/shift", "/attendance"].includes(path);
  const title = titles[path] || [
    "Không tìm thấy trang",
    "Quay về bán hàng để tiếp tục.",
  ];
  const lines = Object.entries(cart)
    .map(([id, quantity]) => ({
      product: data.products.find((p) => p.id === id)!,
      quantity,
    }))
    .filter((l) => l.product);
  const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
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
    if (!current) return;
    setBusy(true);
    setError("");
    const id = crypto.randomUUID();
    const cashAmount =
      method === "cash" ? total : method === "transfer" ? 0 : Number(cash);
    const payload: Checkout = {
      id,
      shift_id: current.id,
      lines: lines.map((l) => ({
        product_id: l.product.id,
        quantity: l.quantity,
        price: l.product.price,
      })),
      cash: cashAmount,
      transfer: total - cashAmount,
      occurred_at: new Date().toISOString(),
      offline: !online,
    };
    try {
      if (
        !Number.isSafeInteger(cashAmount) ||
        cashAmount < 0 ||
        cashAmount > total
      )
        throw Error("Số tiền mặt phải nằm trong tổng giá trị đơn.");
      const delivered = await submitCheckout(data!, payload);
      if (!delivered) {
        setQueue(await pending());
        setReceipt({
          id,
          number: "LOCAL-" + id.slice(0, 8).toUpperCase(),
          user_id: data!.user.id,
          shift_id: current.id,
          created_at: payload.occurred_at,
          total,
          cash: payload.cash,
          transfer: payload.transfer,
          status: "completed",
          sync: "pending",
          lines: lines.map(({ product, quantity }) => ({
            product_id: product.id,
            name: product.name,
            variant: product.variant,
            price: product.price,
            quantity,
          })),
        });
        setNotice("Đơn đã lưu trên thiết bị, chờ đồng bộ.");
      } else {
        const s = await reload();
        setReceipt(s.orders.find((o) => o.id === id) || null);
        setNotice("Thanh toán thành công.");
      }
      setCart({});
      setPayment(false);
      setMobileCart(false);
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
          email: str("email"),
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
          <h2 style={{ fontFamily: "monospace", letterSpacing: "1px" }}>
            NEW_ORDER
          </h2>
          <span>{itemCount} sản phẩm</span>
        </div>
        <IconButton
          label="Xóa giỏ hàng"
          onClick={() => {
            if (!itemCount || confirm("Xóa toàn bộ sản phẩm trong giỏ?"))
              setCart({});
          }}
        >
          <Trash2 size={17} />
        </IconButton>
      </div>
      <div className="cart-context">
        <span>
          <span className="status-dot" />{" "}
          {current ? "Ca đang mở" : "Chưa bắt đầu ca"}
        </span>
        <span>{data.user.name.split(" ").at(-1)}</span>
      </div>
      <div className="cart-lines">
        {lines.length ? (
          lines.map(({ product: p, quantity }) => (
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
                    <Minus size={12} />
                  </button>
                  <b>{quantity}</b>
                  <button
                    aria-label={"Tăng " + p.name}
                    onClick={() => changeQty(p.id, 1)}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              <span className="money">{money(p.price * quantity)}</span>
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
        <div className="summary-row">
          <span>Tạm tính</span>
          <span>{money(total)}</span>
        </div>
        <div className="summary-row">
          <span>Số lượng</span>
          <span>{itemCount} sản phẩm</span>
        </div>
        <div className="total-row">
          <strong>Tổng cộng</strong>
          <strong>{money(total)}</strong>
        </div>
        <button
          className="primary checkout-button"
          disabled={!itemCount || busy}
          data-state={busy ? "loading" : undefined}
          onClick={() => {
            if (!current) {
              setModal("shift-open");
              return;
            }
            setCash(String(total));
            setPayment(true);
          }}
        >
          [ THANH TOÁN ]
        </button>
        <p className="secure-note">
          <ShieldCheck size={12} />{" "}
          {isDemo()
            ? "Trải nghiệm · Dữ liệu trên thiết bị"
            : "Giao dịch được ghi nhận an toàn"}
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
          <div className="brand-symbol">InsideOut</div>
          <div>
            <strong>TERMINAL</strong>
            <span>v1.0.0</span>
          </div>
        </Link>
        <div className="shop-select">
          <div className="shop-avatar">IO</div>
          <div>
            <strong>{data.settings.name}</strong>
            <span>Cửa hàng của bạn</span>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">KHÔNG GIAN LÀM VIỆC</div>
        <nav>
          {navigation
            .filter((n) => !n.admin || admin)
            .map((n) => (
              <Link
                key={n.href}
                aria-label={n.label}
                href={n.href}
                className={path === n.href ? "active" : ""}
              >
                <n.icon size={19} strokeWidth={1.6} />
                <span>{n.label}</span>
                {path === n.href && <span className="nav-active-dot" />}
              </Link>
            ))}
        </nav>
        <div className="sidebar-footer">
          <div className="system-status">
            <span className={"status-dot " + (online ? "" : "offline")} />
            {online ? "Hệ thống sẵn sàng" : "Đang ngoại tuyến"}
            <span className="version">v0.1</span>
          </div>
          <button className="user-card" onClick={switchProfile}>
            <span className="avatar" style={{ background: data.user.color }}>
              {data.user.name.split(" ").at(-1)?.[0]}
            </span>
            <span>
              <strong>{data.user.name}</strong>
              <small>{admin ? "Quản lý cửa hàng" : "Nhân viên"}</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="eyebrow" style={{ fontFamily: "monospace" }}>SYS/WORKSPACE</span>
            <span className="heading-dot" />
            <span className="eyebrow" style={{ fontFamily: "monospace" }}>
              {String(title[0] || "Unknown").toUpperCase()}
            </span>
          </div>
          <div className="top-actions">
            <span className="today-label">
              {new Intl.DateTimeFormat("vi-VN", {
                weekday: "short",
                day: "numeric",
                month: "long",
              }).format(new Date())}
            </span>
            <button className="sync-button" onClick={() => setModal("queue")}>
              {online ? <CloudCheck size={16} /> : <CloudOff size={16} />}
              <span>
                {queue.length
                  ? queue.length + " chờ đồng bộ"
                  : isDemo()
                    ? "Dữ liệu trải nghiệm"
                    : "Đã đồng bộ"}
              </span>
            </button>
            <IconButton label="Đổi giao diện" onClick={toggleTheme}>
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
          </div>
        </header>
        <main id="main" className={path === "/pos" ? "main pos-main" : "main"}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">INSIDE OUT MANAGER</div>
              <h1>
                {title[0]}
                <span className="heading-dot">.</span>
              </h1>
              <p>{title[1]}</p>
            </div>
            {path === "/pos" ? (
              <div className="sales-today">
                <span>Doanh thu hôm nay</span>
                <strong>
                  {money(todaySales.reduce((s, o) => s + o.total, 0))}
                </strong>
                <small>
                  {todaySales.length} đơn hoàn thành <ArrowUpRight size={13} />
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
          {isDemo() && path !== "/pos" && (
            <div className="demo-note">
              Không gian trải nghiệm. Dữ liệu lưu trên trình duyệt này.
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
                      <span>Được tạo cho những ngày làm việc tốt hơn.</span>
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
                  <button
                    className="mobile-cart-toggle primary"
                    onClick={() => setMobileCart(true)}
                  >
                    <ShoppingBag size={18} />
                    {itemCount} sản phẩm <strong>{money(total)}</strong>
                  </button>
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
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Mã đơn</th>
                            <th>Thời gian</th>
                            <th>Nhân viên</th>
                            <th>Thanh toán</th>
                            <th>Trạng thái</th>
                            <th className="right">Tổng cộng</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {data.orders
                            .filter((o) =>
                              o.number
                                .toLowerCase()
                                .includes(search.toLowerCase()),
                            )
                            .map((o) => (
                              <tr key={o.id}>
                                <td>
                                  <button
                                    className="link-button"
                                    onClick={() => setReceipt(o)}
                                  >
                                    {o.number}
                                  </button>
                                </td>
                                <td>{date(o.created_at)}</td>
                                <td>
                                  {data.members.find((m) => m.id === o.user_id)
                                    ?.name || "Nhân viên"}
                                </td>
                                <td>
                                  {o.cash && o.transfer
                                    ? "Kết hợp"
                                    : o.cash
                                      ? "Tiền mặt"
                                      : "Chuyển khoản"}
                                </td>
                                <td>
                                  <span
                                    className={
                                      "badge " +
                                      (o.status === "cancelled"
                                        ? "danger"
                                        : "success")
                                    }
                                  >
                                    {o.status === "cancelled"
                                      ? "Đã hủy"
                                      : "Hoàn thành"}
                                  </span>
                                </td>
                                <td className="right money">
                                  {money(o.total)}
                                </td>
                                <td>
                                  <IconButton
                                    label={"Xem " + o.number}
                                    onClick={() => setReceipt(o)}
                                  >
                                    <ChevronRight size={17} />
                                  </IconButton>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
              {isShift && (
                <>
                  <div className="stats-grid">
                    <Stat
                      label="Trạng thái hôm nay"
                      value={current ? "Đang trong ca" : "Chưa mở ca"}
                      detail={
                        current
                          ? "Bắt đầu " + date(current.started_at)
                          : "Sẵn sàng cho một ngày mới"
                      }
                    />
                    <Stat
                      label="Doanh thu trong ca"
                      value={money(
                        sales
                          .filter((o) => o.shift_id === current?.id)
                          .reduce((s, o) => s + o.total, 0),
                      )}
                      detail="Chỉ tính đơn hoàn thành"
                    />
                    <Stat
                      label="Tiền mặt dự kiến"
                      value={money(
                        current ? expectedCash(current, data.orders) : 0,
                      )}
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
                    <table>
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
                              <td>
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
                              <td className="muted">{p.sku}</td>
                              <td className="money">{money(p.price)}</td>
                              <td className="money muted">
                                {money(p.cost || 0)}
                              </td>
                              <td>
                                <span
                                  className={
                                    "badge " + (p.stock <= 5 ? "warning" : "")
                                  }
                                >
                                  {p.stock}
                                </span>
                              </td>
                              <td>
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
                                  <IconButton
                                    label={
                                      p.active
                                        ? "Lưu trữ sản phẩm"
                                        : "Khôi phục sản phẩm"
                                    }
                                    onClick={() => {
                                      if (
                                        confirm(
                                          p.active
                                            ? "Lưu trữ sản phẩm này?"
                                            : "Khôi phục sản phẩm này?",
                                        )
                                      )
                                        mutate({
                                          type: "product",
                                          payload: { ...p, active: !p.active },
                                        });
                                    }}
                                  >
                                    <Package size={15} />
                                  </IconButton>
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
                <div className="staff-grid">
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
                      </section>
                    );
                  })}
                </div>
              )}
              {path === "/finance" && (
                <>
                  <div className="stats-grid">
                    <Stat
                      label="Tổng doanh thu đã ghi nhận"
                      value={money(sales.reduce((s, o) => s + o.total, 0))}
                      detail="Đơn hàng hoàn thành"
                    />
                    <Stat
                      label="Chi phí vận hành"
                      value={money(
                        data.expenses.reduce((s, e) => s + e.amount, 0),
                      )}
                      detail="Các khoản chi đã ghi nhận"
                    />
                    <Stat
                      label="Ca chờ duyệt"
                      value={String(
                        data.shifts.filter((s) => s.status === "submitted")
                          .length,
                      )}
                      detail="Đối soát tiền mặt"
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
                                <td>{e.note}</td>
                                <td>{e.category}</td>
                                <td>{date(e.created_at)}</td>
                                <td className="right money">
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
              )}{" "}
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
      {payment && (
        <Modal
          title="Hoàn tất thanh toán"
          close={() => {
            if (!busy) setPayment(false);
          }}
        >
          <div className="payment-total">
            <span>Tổng cần thanh toán</span>
            <strong>{money(total)}</strong>
          </div>
          <div className="payment-methods">
            {[
              ["cash", "Tiền mặt"],
              ["transfer", "Chuyển khoản"],
              ["mixed", "Kết hợp"],
            ].map(([v, l]) => (
              <button
                key={v}
                className={method === v ? "selected" : ""}
                onClick={() => setMethod(v)}
              >
                <CreditCard size={20} />
                {l}
              </button>
            ))}
          </div>
          {method === "mixed" && (
            <>
              <Field label="Số tiền mặt">
                <input
                  type="number"
                  min="0"
                  max={total}
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                />
              </Field>
              <div className="summary-row">
                <span>Chuyển khoản</span>
                <strong>{money(total - Number(cash))}</strong>
              </div>
            </>
          )}
          {method !== "cash" && (
            <p className="form-hint">
              Kiểm tra tiền đã vào tài khoản trước khi xác nhận. Ứng dụng không
              tự xác minh giao dịch ngân hàng.
            </p>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button
            className="primary full"
            disabled={busy}
            data-state={busy ? "loading" : undefined}
            onClick={checkout}
          >
            {busy
              ? "Đang ghi nhận…"
              : online
                ? "Xác nhận thanh toán"
                : "Lưu đơn trên thiết bị"}
            <Check size={17} />
          </button>
        </Modal>
      )}
      {receipt && (
        <Modal title="Chi tiết đơn hàng" close={() => setReceipt(null)}>
          <div className="receipt" id="receipt">
            <h2>{data.settings.name}</h2>
            <p>{data.settings.address}</p>
            <p>{data.settings.phone}</p>
            <hr />
            <h3>{receipt.number}</h3>
            {receipt.sync && <p>ĐÃ LƯU TRÊN THIẾT BỊ · CHỜ MÁY CHỦ XÁC NHẬN</p>}
            <p>{date(receipt.created_at)}</p>
            {receipt.status === "cancelled" && <p>ĐÃ HỦY · {receipt.reason}</p>}
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
            <hr />
            <div className="total-row">
              <strong>Tổng cộng</strong>
              <strong>{money(receipt.total)}</strong>
            </div>
            <div className="summary-row">
              <span>Tiền mặt</span>
              <span>{money(receipt.cash)}</span>
            </div>
            <div className="summary-row">
              <span>Chuyển khoản</span>
              <span>{money(receipt.transfer)}</span>
            </div>
            <hr />
            <p>{data.settings.receipt_footer}</p>
          </div>
          <div className="modal-actions">
            <button className="primary" onClick={() => window.print()}>
              <Printer size={17} />
              In hóa đơn
            </button>
            {receipt.status === "completed" &&
              !receipt.sync &&
              (admin || data.settings.allow_staff_cancel) && (
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={async () => {
                    const reason = prompt("Lý do hủy đơn (bắt buộc):");
                    if (
                      reason?.trim() &&
                      (await mutate({
                        type: "cancel",
                        payload: { id: receipt.id, reason },
                      }))
                    )
                      setReceipt(null);
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
      {modal && modal !== "queue" && (
        <Modal
          title={
            {
              product: editing ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm",
              stock: "Điều chỉnh tồn kho",
              expense: "Ghi nhận chi phí",
              member: editing ? "Thông tin nhân viên" : "Thêm nhân viên",
              "shift-open": "Bắt đầu ca làm",
              "shift-close": "Kết ca & đối soát",
            }[modal]
          }
          close={() => {
            setModal(null);
            setError("");
          }}
        >
          <form onSubmit={submitForm} className="stack-form">
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
                  <input name="amount" type="number" min="1" required />
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
                  <input
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
                    <Field label="Email">
                      <input name="email" type="email" required={!isDemo()} />
                    </Field>
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
                  <input
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
                  <input name="actual_cash" type="number" min="0" required />
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
                  <strong>{money(q.payload.cash + q.payload.transfer)}</strong>
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
              title={
                isDemo()
                  ? "Đang sử dụng dữ liệu trải nghiệm"
                  : "Tất cả đã được đồng bộ"
              }
              detail={
                isDemo()
                  ? "Các thao tác được lưu trên trình duyệt. Đăng nhập để sử dụng dữ liệu cửa hàng."
                  : "Đơn hàng đã được ghi nhận trên máy chủ."
              }
            />
          )}
        </Modal>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <section className="panel stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}
function ShiftTable({
  data,
  onApprove,
}: {
  data: Snapshot;
  onApprove: (id: string) => void;
}) {
  return (
    <section className="panel">
      <div className="section-toolbar">
        <h2>Đối soát ca làm</h2>
      </div>
      {!data.shifts.length ? (
        <Empty
          title="Chưa có ca làm"
          detail="Ca làm sẽ xuất hiện sau khi chấm công vào."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Bắt đầu</th>
                <th>Kết thúc</th>
                <th>Dự kiến</th>
                <th>Thực tế</th>
                <th>Chênh lệch</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {data.shifts.map((s) => (
                <tr key={s.id}>
                  <td>
                    {data.members.find((m) => m.id === s.user_id)?.name ||
                      "Bạn"}
                  </td>
                  <td>{date(s.started_at)}</td>
                  <td>{s.ended_at ? date(s.ended_at) : "Đang làm"}</td>
                  <td className="money">
                    {money(s.expected_cash ?? expectedCash(s, data.orders))}
                  </td>
                  <td className="money">
                    {s.actual_cash === null ? "—" : money(s.actual_cash)}
                  </td>
                  <td className="money">
                    {s.actual_cash === null
                      ? "—"
                      : money(s.actual_cash - (s.expected_cash || 0))}
                  </td>
                  <td>
                    {s.status === "submitted" && data.user.role === "admin" ? (
                      <button
                        className="secondary"
                        onClick={() => onApprove(s.id)}
                      >
                        Duyệt ca
                      </button>
                    ) : (
                      <span className="badge">
                        {s.status === "open"
                          ? "Đang mở"
                          : s.status === "approved"
                            ? "Đã duyệt"
                            : "Chờ duyệt"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
function ProductFields({ product: p }: { product: Product | null }) {
  return (
    <>
      <Field label="Tên sản phẩm">
        <input name="name" required maxLength={120} defaultValue={p?.name} />
      </Field>
      <div className="form-grid">
        <Field label="SKU">
          <input name="sku" required defaultValue={p?.sku} />
        </Field>
        <Field label="Danh mục">
          <select name="category" defaultValue={p?.category || "Áo thun"}>
            {["Áo thun", "Hoodie", "Quần", "Phụ kiện"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Biến thể">
        <input
          name="variant"
          required
          placeholder="Đen / M"
          defaultValue={p?.variant}
        />
      </Field>
      <div className="form-grid">
        <Field label="Giá bán (₫)">
          <input
            name="price"
            type="number"
            min="0"
            required
            defaultValue={p?.price}
          />
        </Field>
        <Field label="Giá vốn (₫)">
          <input
            name="cost"
            type="number"
            min="0"
            required
            defaultValue={p?.cost}
          />
        </Field>
        <Field label={p ? "Tồn kho (điều chỉnh riêng)" : "Tồn kho ban đầu"}>
          <input
            name="stock"
            type="number"
            min="0"
            readOnly={!!p}
            defaultValue={p?.stock || 0}
          />
        </Field>
        <Field label="Màu sản phẩm">
          <input
            name="color"
            type="color"
            defaultValue={p?.color || "#676b63"}
          />
        </Field>
      </div>
      <Field label="Dáng sản phẩm">
        <select name="kind" defaultValue={p?.kind || "tee"}>
          <option value="tee">Áo thun</option>
          <option value="hoodie">Hoodie</option>
          <option value="pants">Quần</option>
          <option value="bag">Túi</option>
          <option value="cap">Mũ</option>
        </select>
      </Field>
    </>
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
    <div className="settings-layout">
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
            idle_minutes: Number(f.get("idle_minutes")),
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
          <Field label="Tự khóa sau (phút)">
            <input
              name="idle_minutes"
              type="number"
              min="1"
              max="120"
              defaultValue={data.settings.idle_minutes}
            />
          </Field>
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
            <div className="audit-item" key={a.id}>
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
function Login({ onSuccess }: { onSuccess: () => void }) {
  const [list, setList] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"email" | "profiles">("email");
  useEffect(() => {
    profiles()
      .then((m) => {
        setList(m);
        setView("profiles");
      })
      .catch(() => {});
  }, []);
  async function enterPin(value: string) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      if (isDemo()) await demoLogin(selected.id);
      else {
        await request("auth/pin", { id: selected.id, pin: value });
        sessionStorage.setItem("io-user", selected.id);
      }
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
      setPin("");
    } finally {
      setBusy(false);
    }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const f = new FormData(e.currentTarget);
      sessionStorage.removeItem("io-demo");
      const result = await request("auth/login", {
        email: f.get("email"),
        password: f.get("password"),
      });
      sessionStorage.setItem("io-user", result.id);
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <Link href="/login" className="brand">
        <div className="brand-symbol">InsideOut</div>
        <div>
          <strong>TERMINAL</strong>
          <span>v1.0.0</span>
        </div>
      </Link>
      <section
        className={
          "login-content " + (view === "profiles" ? "profiles-content" : "")
        }
      >
        <div className="eyebrow">MỘT KHÔNG GIAN. CÙNG NHAU VẬN HÀNH.</div>
        <h1>
          {selected
            ? "Chào " + selected.name.split(" ").at(-1) + "."
            : view === "profiles"
              ? "Ai đang làm việc?"
              : "Một ngày tốt đẹp,\nbắt đầu từ đây."}
        </h1>
        <p>
          {selected
            ? "Nhập mã PIN để vào không gian làm việc."
            : view === "profiles"
              ? "Chọn hồ sơ của bạn để tiếp tục."
              : "Đăng nhập để đồng hành cùng cửa hàng hôm nay."}
        </p>
        {view === "email" ? (
          <form className="stack-form" onSubmit={login}>
            <Field label="Email hoặc số điện thoại">
              <input
                name="email"
                type="text"
                autoComplete="username"
                placeholder="you@insideout.vn"
                required
              />
            </Field>
            <Field label="Mật khẩu">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
              />
            </Field>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary full"
              disabled={busy}
              data-state={busy ? "loading" : undefined}
            >
              {busy ? "Đang đăng nhập…" : "Vào không gian làm việc"}
              <ArrowUpRight size={18} />
            </button>
            <div className="login-divider">
              <span>Khám phá trước khi bắt đầu</span>
            </div>
            <button
              type="button"
              className="secondary full"
              onClick={() => {
                sessionStorage.setItem("io-demo", "true");
                setList(seed().members);
                setView("profiles");
                setError("");
              }}
            >
              Trải nghiệm với dữ liệu mẫu
              <ArrowUpRight size={16} />
            </button>
            <small className="muted">
              Dữ liệu mẫu chỉ lưu trên trình duyệt, tách biệt cửa hàng thật.
            </small>
          </form>
        ) : selected ? (
          <div className="pin-area">
            <div className="pin-dots" aria-label={pin.length + " số đã nhập"}>
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className={i < pin.length ? "filled" : ""} />
              ))}
            </div>
            {isDemo() && (
              <p className="form-hint">Chế độ trải nghiệm: nhập 4 số bất kỳ.</p>
            )}
            <input
              className="sr-only"
              aria-label="Mã PIN"
              inputMode="numeric"
              type="password"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
            <div className="pin-pad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "✓"].map(
                (key) => (
                  <button
                    key={key}
                    disabled={busy}
                    aria-label={
                      key === "←"
                        ? "Xóa số"
                        : key === "✓"
                          ? "Xác nhận PIN"
                          : key
                    }
                    onClick={() => {
                      if (key === "←") setPin(pin.slice(0, -1));
                      else if (key === "✓") {
                        if (pin.length >= 4) enterPin(pin);
                      } else if (pin.length < 6) setPin(pin + key);
                    }}
                  >
                    {key}
                  </button>
                ),
              )}
            </div>
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
            <div className="profile-grid">
              {list
                .filter((m) => m.active)
                .map((m) => (
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
            <button
              className="text-button"
              onClick={() => {
                setView("email");
                sessionStorage.removeItem("io-demo");
              }}
            >
              Đăng nhập bằng email
              <ArrowUpRight size={14} />
            </button>
          </>
        )}
      </section>
      <footer>inside out · Những điều tốt đẹp bắt đầu từ bên trong.</footer>
    </main>
  );
}
