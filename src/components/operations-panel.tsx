"use client";
import { useState, useEffect, type FormEvent } from "react";
import {
  Download,
  ShieldCheck,
  Upload,
  Clock,
  Wallet,
  Check,
  RefreshCw,
  UserPlus,
  Package,
  ArrowRightLeft,
} from "lucide-react";
import type { Snapshot, Command, PayrollLine } from "@/lib/types";
import { businessDay, date, money } from "@/lib/domain";
import { calculatePeriod } from "@/lib/payroll";
import {
  request,
  isDemo,
  execute,
  pending,
  resolvePending,
  type Pending,
} from "@/lib/client";
type Props = {
  data: Snapshot;
  path: string;
  onSave: (command: Command) => Promise<boolean>;
  onReload: () => Promise<Snapshot>;
};
const csvValue = (v: unknown) =>
  '"' +
  String(v ?? "")
    .replace(/^([=+\-@])/, "'$1")
    .replaceAll('"', '""') +
  '"';
function download(name: string, rows: unknown[][]) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(
    new Blob(
      ["\uFEFF" + rows.map((row) => row.map(csvValue).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export default function OperationsPanel({
  data,
  path,
  onSave,
  onReload,
}: Props) {
  const today = businessDay(new Date().toISOString());
  const [start, setStart] = useState(today.slice(0, 7) + "-01"),
    [end, setEnd] = useState(today),
    [preview, setPreview] = useState<PayrollLine[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [queue, setQueue] = useState<Pending[]>([]),
    [selected, setSelected] = useState(data.members[0]?.id || "");
  useEffect(() => {
    if (path === "/admin/settings") {
      pending().then(setQueue);
    }
  }, [path, data]);
  async function run(fn: () => Promise<unknown>) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const result = await fn();
      if (result !== false) setMessage("Đã hoàn tất.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const closed = data.shifts.filter((s) => s.ended_at);
  const first = data.members.find((m) => m.id === selected);
  async function previewPay() {
    await run(async () => {
      const lines = isDemo()
        ? calculatePeriod(data, start, end)
        : await request("payroll/preview", {
            start_date: start,
            end_date: end,
          });
      setPreview(lines);
    });
  }
  async function approve(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!preview) return;
    const f = new FormData(e.currentTarget);
    const adjustments = Object.fromEntries(
      preview.map((l) => [
        l.user_id,
        {
          amount: Number(f.get("adjustment-" + l.user_id) || 0),
          note: String(f.get("note-" + l.user_id) || ""),
        },
      ]),
    );
    await run(async () => {
      if (
        await onSave({
          type: "payroll_approve",
          payload: { start_date: start, end_date: end, adjustments },
        })
      )
        setPreview(null);
    });
  }
  return (
    <div className="panel-group">
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-hint" role="status">
          {message}
        </p>
      )}
      {path === "/admin/payroll" && (
        <>
          <section className="panel settings-form">
            <h2>
              <Wallet size={18} /> Lập bảng lương
            </h2>
            <p className="muted small-text">
              Tính theo giờ thực tế và quy tắc có hiệu lực tại từng thời điểm.
              Phê duyệt sẽ khóa bản tính của kỳ.
            </p>
            <div className="form-grid">
              <Field label="Từ ngày">
                <input
                  type="date"
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    setPreview(null);
                  }}
                />
              </Field>
              <Field label="Đến ngày">
                <input
                  type="date"
                  value={end}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    setPreview(null);
                  }}
                />
              </Field>
            </div>
            <button
              className="primary"
              disabled={busy}
              data-state={busy ? "loading" : undefined}
              onClick={previewPay}
            >
              Tính lương dự kiến
              <RefreshCw size={16} />
            </button>
          </section>
          {preview && (
            <form className="panel settings-form" onSubmit={approve}>
              <h2>Bảng lương dự kiến</h2>
              <div className="table-wrap" data-table="terminal">
                <table>
                  <thead>
                    <tr>
                      <th>Nhân viên</th>
                      <th>Giờ</th>
                      <th>Lương cơ bản</th>
                      <th>Thưởng</th>
                      <th>Điều chỉnh (₫)</th>
                      <th>Lý do</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((l) => (
                      <tr key={l.user_id}>
                        <td>{l.name}</td>
                        <td>{(l.minutes / 60).toFixed(2)}</td>
                        <td>{money(l.base)}</td>
                        <td>{money(l.bonus)}</td>
                        <td>
                          <input
                            aria-label={"Điều chỉnh " + l.name}
                            name={"adjustment-" + l.user_id}
                            type="number"
                            defaultValue="0"
                            style={{ minWidth: 120 }}
                          />
                        </td>
                        <td>
                          <input
                            aria-label={"Lý do " + l.name}
                            name={"note-" + l.user_id}
                            style={{ minWidth: 160 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="primary"
                disabled={busy}
                data-state={busy ? "loading" : undefined}
              >
                Phê duyệt & lưu bản tính
                <Check size={16} />
              </button>
            </form>
          )}
          <section className="panel settings-form">
            <h2>Kỳ lương đã duyệt</h2>
            {!(data.payroll_periods || []).length && (
              <p className="muted">Chưa có kỳ lương được phê duyệt.</p>
            )}
            {(data.payroll_periods || []).map((p) => (
              <details className="payroll-period" key={p.id}>
                <summary>
                  {p.start_date} → {p.end_date} ·{" "}
                  {money(p.lines.reduce((n, l) => n + l.total, 0))} ·{" "}
                  {p.status === "paid" ? "Đã thanh toán" : "Đã duyệt"}
                </summary>
                <div className="table-wrap" data-table="terminal">
                  <table>
                    <thead>
                      <tr>
                        <th>Nhân viên</th>
                        <th>Lương</th>
                        <th>Thưởng</th>
                        <th>Điều chỉnh</th>
                        <th>Thực nhận</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.lines.map((l) => (
                        <tr key={l.user_id}>
                          <td>{l.name}</td>
                          <td>{money(l.base)}</td>
                          <td>{money(l.bonus)}</td>
                          <td title={l.note}>{money(l.adjustment)}</td>
                          <td>{money(l.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="row-actions">
                  <button
                    className="secondary"
                    onClick={() =>
                      download("luong-" + p.start_date + ".csv", [
                        [
                          "Nhân viên",
                          "Phút làm",
                          "Lương cơ bản",
                          "Doanh số",
                          "Thưởng",
                          "Điều chỉnh",
                          "Lý do",
                          "Thực nhận",
                        ],
                        ...p.lines.map((l) => [
                          l.name,
                          l.minutes,
                          l.base,
                          l.sales,
                          l.bonus,
                          l.adjustment,
                          l.note,
                          l.total,
                        ]),
                      ])
                    }
                  >
                    <Download size={16} />
                    Xuất CSV
                  </button>
                  {p.status === "approved" && (
                    <button
                      className="primary"
                      disabled={busy}
                      data-state={busy ? "loading" : undefined}
                      onClick={() =>
                        run(() =>
                          onSave({
                            type: "payroll_paid",
                            payload: { id: p.id },
                          }),
                        )
                      }
                    >
                      Đánh dấu đã thanh toán
                    </button>
                  )}
                </div>
              </details>
            ))}
          </section>
        </>
      )}
      {path === "/admin/staff" && (
        <div className="grid-layout">
          <section className="panel settings-form">
            <h2>Quy tắc lương có hiệu lực</h2>
            <form
              className="stack-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(() =>
                  onSave({
                    type: "pay_rule",
                    payload: {
                      user_id: f.get("user_id"),
                      hourly_rate: Number(f.get("hourly_rate")),
                      bonus_percent: Number(f.get("bonus_percent")),
                      effective_at: new Date(
                        String(f.get("effective_at")),
                      ).toISOString(),
                    },
                  }),
                );
              }}
            >
              <Field label="Nhân viên">
                <select
                  name="user_id"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {data.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lương theo giờ (₫)">
                <input
                  key={selected}
                  type="number"
                  name="hourly_rate"
                  min="0"
                  required
                  defaultValue={first?.hourly_rate || 25000}
                />
              </Field>
              <Field label="Thưởng doanh số (%)">
                <input
                  type="number"
                  name="bonus_percent"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  defaultValue={data.settings.bonus_percent}
                />
              </Field>
              <Field label="Có hiệu lực từ">
                <input type="datetime-local" name="effective_at" required />
              </Field>
              <button
                className="primary"
                disabled={busy}
                data-state={busy ? "loading" : undefined}
              >
                Lưu quy tắc
              </button>
            </form>
            <div className="table-wrap" data-table="terminal">
              <table>
                <thead>
                  <tr>
                    <th>Hiệu lực</th>
                    <th>Lương/giờ</th>
                    <th>Thưởng</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.pay_rules || [])
                    .filter((r) => r.user_id === selected)
                    .map((r) => (
                      <tr key={r.id}>
                        <td>{date(r.effective_at)}</td>
                        <td>{money(r.hourly_rate)}</td>
                        <td>{r.bonus_percent}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel settings-form">
            <h2>
              <ShieldCheck size={18} /> Quyền truy cập & PIN
            </h2>
            <Field label="Nhân viên">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {data.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <button
              className="secondary"
              disabled={busy || selected === data.user.id}
              data-state={busy ? "loading" : undefined}
              onClick={() =>
                run(() =>
                  onSave({
                    type: "member_status",
                    payload: { id: selected, active: !first?.active },
                  }),
                )
              }
            >
              {first?.active ? "Vô hiệu hóa tài khoản" : "Kích hoạt tài khoản"}
            </button>
            <form
              className="stack-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                run(async () => {
                  if (isDemo())
                    await execute({
                      type: "pin_reset",
                      payload: { id: selected, pin: f.get("pin") },
                    });
                  else
                    await request("security/pin", {
                      id: selected,
                      pin: f.get("pin"),
                      current_pin: f.get("current_pin"),
                    });
                  form.reset();
                  await onReload();
                });
              }}
            >
              <Field label="PIN mới (4 đến 6 số)">
                <input
                  type="password"
                  name="pin"
                  inputMode="numeric"
                  pattern="[0-9]{4,6}"
                  autoComplete="new-password"
                  required
                />
              </Field>
              <Field label="PIN hiện tại của quản lý">
                <input
                  type="password"
                  name="current_pin"
                  inputMode="numeric"
                  pattern="[0-9]{4,6}"
                  autoComplete="current-password"
                  required={!isDemo()}
                />
              </Field>
              <button
                className="primary"
                disabled={busy}
                data-state={busy ? "loading" : undefined}
              >
                Đặt PIN & mở khóa
              </button>
              <p className="form-hint">
                PIN quản lý được xác minh lại trước khi thay đổi hoặc mở khóa
                hồ sơ.
              </p>
            </form>
            <AssetUpload data={data} kind="avatar" onReload={onReload} />
          </section>

          <section className="panel settings-form">
            <h2>
              <UserPlus size={18} /> Thêm nhân viên mới
            </h2>
            <form
              className="stack-form"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                run(async () => {
                  if (isDemo()) {
                    throw Error("Không hỗ trợ tạo nhân viên trong chế độ dùng thử.");
                  }
                  await onSave({
                    type: "member",
                    payload: {
                    name: f.get("name"),
                    pin: f.get("pin"),
                    hourly_rate: 25000,
                    role: "staff",
                    },
                  });
                  form.reset();
                  await onReload();
                });
              }}
            >
              <Field label="Tên nhân viên">
                <input type="text" name="name" required placeholder="Nguyễn Văn B" />
              </Field>
              <Field label="Mã PIN (4 đến 6 số)">
                <input type="password" name="pin" inputMode="numeric" pattern="[0-9]{4,6}" required />
              </Field>
              <button className="primary" disabled={busy} data-state={busy ? "loading" : undefined}>
                Tạo tài khoản
              </button>
            </form>
          </section>
        </div>
      )}
      {path === "/admin/attendance" && (
        <section className="panel settings-form">
          <h2>
            <Clock size={18} /> Điều chỉnh chấm công
          </h2>
          <p className="muted small-text">
            Mọi thay đổi đều lưu lý do và giờ trước khi sửa. Ca thuộc kỳ lương
            đã duyệt được khóa.
          </p>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(() =>
                onSave({
                  type: "attendance_correct",
                  payload: {
                    id: f.get("id"),
                    started_at: new Date(
                      String(f.get("started_at")),
                    ).toISOString(),
                    ended_at: new Date(String(f.get("ended_at"))).toISOString(),
                    reason: f.get("reason"),
                  },
                }),
              );
            }}
          >
            <Field label="Ca cần điều chỉnh">
              <select name="id" required disabled={closed.length === 0}>
                {closed.length === 0 ? <option>Chưa có dữ liệu</option> : closed.map((s) => (
                  <option key={s.id} value={s.id}>
                    {data.members.find((m) => m.id === s.user_id)?.name} ·{" "}
                    {date(s.started_at)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Giờ vào đúng">
                <input name="started_at" type="datetime-local" required />
              </Field>
              <Field label="Giờ ra đúng">
                <input name="ended_at" type="datetime-local" required />
              </Field>
            </div>
            <Field label="Lý do">
              <textarea name="reason" required />
            </Field>
            <button
              className="primary"
              disabled={busy || !closed.length}
              data-state={busy ? "loading" : undefined}
            >
              Lưu điều chỉnh
            </button>
          </form>
        </section>
      )}
      {path === "/admin/products" && (
        <section className="panel settings-form">
          <h2>Hình ảnh sản phẩm</h2>
          <AssetUpload data={data} kind="product" onReload={onReload} />
          <h2>Lịch sử tồn kho</h2>
          <div className="table-wrap" data-table="terminal">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Sản phẩm</th>
                  <th>Thay đổi</th>
                  <th>Lý do</th>
                </tr>
              </thead>
              <tbody>
                {data.movements.slice(0, 100).map((m) => (
                  <tr key={m.id}>
                    <td data-label="Thời gian">{date(m.created_at)}</td>
                    <td data-label="Sản phẩm">
                      <span className="badge">
                        <Package size={14} />
                        {data.products.find((p) => p.id === m.product_id)?.name}
                      </span>
                    </td>
                    <td data-label="Thay đổi">
                      <span className={`badge ${m.quantity > 0 ? 'success' : m.quantity < 0 ? 'danger' : ''}`}>
                        <ArrowRightLeft size={14} />
                        {m.quantity > 0 ? "+" : ""}
                        {m.quantity}
                      </span>
                    </td>
                    <td data-label="Lý do">{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {path === "/admin/settings" && (
        <div className="grid-layout">
          <section className="panel settings-form">
            <h2>Cài đặt cửa hàng</h2>
            <p className="muted small-text">
              Thông tin cửa hàng sẽ hiển thị trên ứng dụng và hóa đơn in cho khách.
            </p>
            <form
              className="stack-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(async () => {
                  const s = { ...data.settings };
                  s.name = String(f.get("name") || "").trim();
                  s.address = String(f.get("address") || "").trim();
                  s.phone = String(f.get("phone") || "").trim();
                  s.receipt_footer = String(f.get("receipt_footer") || "").trim();
                  if (await onSave({ type: "settings", payload: s })) {
                    await onReload();
                  }
                });
              }}
            >
              <Field label="Tên cửa hàng">
                <input name="name" required defaultValue={data.settings.name} maxLength={100} />
              </Field>
              <Field label="Địa chỉ">
                <input name="address" defaultValue={data.settings.address} maxLength={200} />
              </Field>
              <div className="form-grid">
                <Field label="Số điện thoại">
                  <input name="phone" defaultValue={data.settings.phone} maxLength={30} />
                </Field>
              </div>
              <Field label="Lời chúc cuối hóa đơn">
                <textarea name="receipt_footer" defaultValue={data.settings.receipt_footer} maxLength={300} rows={3} />
              </Field>
              <button
                className="primary"
                disabled={busy}
                data-state={busy ? "loading" : undefined}
              >
                Lưu cài đặt
              </button>
            </form>
          </section>
          
          <section className="panel settings-form">
            <h2>Đối soát đơn chờ đồng bộ</h2>
            <p className="muted small-text">
              Giữ nguyên số tiền khách đã trả. Quản lý xác nhận đơn, người bán
              và lý do trước khi ghi nhận. Ca đã đóng sẽ được gửi duyệt lại.
            </p>
            {queue
              .filter((q) => q.shop_id === data.shop_id)
              .map((q) => (
                <form
                  className="queue-item stack-form"
                  key={q.id}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    run(async () => {
                      await resolvePending(q, String(f.get("reason")));
                      setQueue(await pending());
                      await onReload();
                    });
                  }}
                >
                  <strong>
                    {money(q.payload.cash + q.payload.transfer + q.payload.card)} ·{" "}
                    {data.members.find((m) => m.id === q.actor_id)?.name ||
                      q.actor_id}
                  </strong>
                  <p>{q.error || "Chờ đồng bộ"}</p>
                  <Field label="Lý do xác nhận thủ công">
                    <input name="reason" required />
                  </Field>
                  <button
                    className="primary"
                    disabled={busy}
                    data-state={busy ? "loading" : undefined}
                  >
                    Xác nhận & ghi nhận đơn
                  </button>
                </form>
              ))}
            {!queue.length && (
              <p className="muted">
                Không có đơn cần chờ đối soát thủ công.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function AssetUpload({
  data,
  kind,
  onReload,
}: {
  data: Snapshot;
  kind: "avatar" | "product";
  onReload: () => Promise<Snapshot>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const items = kind === "product" ? data.products : data.members;
  return (
    <form
      className="stack-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = e.currentTarget;
        try {
          const f = new FormData(form);
          const file = f.get("file") as File;
          if (
            !file ||
            !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
            file.size > 5 * 1024 * 1024
          )
            throw Error("Chọn ảnh JPG, PNG hoặc WebP dưới 5 MB.");
          const bitmap = await createImageBitmap(file);
          const size = kind === "avatar" ? 512 : 1000;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d")!;
          const side = Math.min(bitmap.width, bitmap.height);
          ctx.drawImage(
            bitmap,
            (bitmap.width - side) / 2,
            (bitmap.height - side) / 2,
            side,
            side,
            0,
            0,
            size,
            size,
          );
          bitmap.close();
          const blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob(
              (b) => (b ? resolve(b) : reject(Error("Không xử lý được ảnh."))),
              "image/webp",
              0.85,
            ),
          );
          if (isDemo()) {
            await execute({
              type: "asset",
              payload: {
                id: f.get("id"),
                kind,
                url: canvas.toDataURL("image/webp", 0.85),
              },
            });
          } else {
            const body = new FormData();
            body.set("file", blob, "image.webp");
            body.set("id", String(f.get("id")));
            body.set("kind", kind);
            const response = await fetch("/api/assets", {
              method: "POST",
              body,
            });
            const result = await response.json();
            if (!response.ok) throw Error(result.error);
          }
          await onReload();
          form.reset();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label={kind === "product" ? "Sản phẩm" : "Hồ sơ"}>
        <select name="id" required disabled={items.length === 0}>
          {items.length === 0 ? <option>Chưa có dữ liệu</option> : items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Ảnh vuông (tự cắt giữa ảnh)">
        <input
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
      </Field>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="secondary"
        disabled={busy || items.length === 0}
        data-state={busy ? "loading" : undefined}
      >
        <Upload size={16} />
        {busy ? "Đang tải ảnh…" : "Lưu ảnh"}
      </button>
    </form>
  );
}
