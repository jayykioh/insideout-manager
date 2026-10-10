"use client";
import { useState } from "react";
import { Download, UserCircle } from "lucide-react";
import type { Snapshot } from "@/lib/types";
import { businessDay, money } from "@/lib/domain";
export default function Reports({ data }: { data: Snapshot }) {
  const [today] = useState(() => businessDay(new Date().toISOString()));
  const [from, setFrom] = useState(today.slice(0, 7) + "-01"),
    [to, setTo] = useState(today);
  const orders = data.orders.filter(
    (o) =>
      o.status === "completed" &&
      businessDay(o.created_at) >= from &&
      businessDay(o.created_at) <= to,
  );
  const revenue = orders.reduce((n, o) => n + o.total, 0),
    cost = orders.reduce((n, o) => n + (o.cost_total || 0), 0),
    expense = data.expenses
      .filter(
        (e) =>
          businessDay(e.created_at) >= from && businessDay(e.created_at) <= to,
      )
      .reduce((n, e) => n + e.amount, 0),
    costKnown = orders.every((o) => o.cost_total !== undefined);
  const days = Array.from(new Set(orders.map((o) => businessDay(o.created_at))))
    .sort()
    .map((day) => ({
      day,
      revenue: orders
        .filter((o) => businessDay(o.created_at) === day)
        .reduce((n, o) => n + o.total, 0),
      count: orders.filter((o) => businessDay(o.created_at) === day).length,
    }));
  const top = data.products
    .map((p) => ({
      name: p.name,
      quantity: orders
        .flatMap((o) => o.lines)
        .filter((l) => l.product_id === p.id)
        .reduce((n, l) => n + l.quantity, 0),
      total: orders
        .flatMap((o) => o.lines)
        .filter((l) => l.product_id === p.id)
        .reduce((n, l) => n + l.price * l.quantity, 0),
    }))
    .filter((p) => p.quantity)
    .sort((a, b) => b.total - a.total);
  const figures = [
    ["Doanh thu", money(revenue)],
    ["Giá vốn", costKnown ? money(cost) : "Thiếu dữ liệu lịch sử"],
    ["Lãi gộp", costKnown ? money(revenue - cost) : "Chưa xác định"],
    ["Chi phí vận hành", money(expense)],
    [
      "Kết quả vận hành",
      costKnown ? money(revenue - cost - expense) : "Chưa xác định",
    ],
    ["Đơn hoàn thành", String(orders.length)],
  ];
  function exportCsv() {
    const rows = [
      ["Ngày", "Số đơn", "Doanh thu"],
      ...days.map((d) => [d.day, d.count, d.revenue]),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + rows.map((r) => r.join(",")).join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "doanh-thu-" + from + "-" + to + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="report-toolbar">
        <div className="form-grid">
          <label className="field">
            <span>Từ ngày</span>
            <input
              aria-label="Báo cáo từ ngày"
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Đến ngày</span>
            <input
              aria-label="Báo cáo đến ngày"
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          <div style={{ display: "flex", flexShrink: 0, background: "var(--surface)", padding: 4, borderRadius: 10, gap: 4, border: "1px solid var(--border)", alignItems: "center" }}>
            <button
              style={{ 
                background: from === today && to === today ? "var(--bg)" : "transparent",
                color: from === today && to === today ? "var(--fg)" : "var(--muted)",
                boxShadow: from === today && to === today ? "0 2px 5px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)" : "none",
                border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "background 200ms ease-out, color 200ms ease-out, box-shadow 200ms ease-out" 
              }}
              onClick={() => {
                setFrom(today);
                setTo(today);
              }}
            >
              Hôm nay
            </button>
            <button
              style={{ 
                background: from === "2020-01-01" && to === today ? "var(--bg)" : "transparent",
                color: from === "2020-01-01" && to === today ? "var(--fg)" : "var(--muted)",
                boxShadow: from === "2020-01-01" && to === today ? "0 2px 5px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)" : "none",
                border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "background 200ms ease-out, color 200ms ease-out, box-shadow 200ms ease-out" 
              }}
              onClick={() => {
                setFrom("2020-01-01");
                setTo(today);
              }}
            >
              Toàn bộ
            </button>
            <button
              style={{ 
                background: from === today.slice(0, 7) + "-01" && to === today ? "var(--bg)" : "transparent",
                color: from === today.slice(0, 7) + "-01" && to === today ? "var(--fg)" : "var(--muted)",
                boxShadow: from === today.slice(0, 7) + "-01" && to === today ? "0 2px 5px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)" : "none",
                border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "background 200ms ease-out, color 200ms ease-out, box-shadow 200ms ease-out" 
              }}
              onClick={() => {
                setFrom(today.slice(0, 7) + "-01");
                setTo(today);
              }}
            >
              Tháng này
            </button>
          </div>
          <button className="secondary" style={{ flexShrink: 0, padding: "6px 14px", fontSize: 13, height: 32, gap: 6, border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 8 }} onClick={exportCsv}>
            <Download size={14} />
            <span className="hide-on-mobile">Tải CSV</span>
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 24 }}>
        {figures.map(([label, value]) => {
          const isErrorState = typeof value === "string" && (value.includes("Thiếu") || value.includes("Chưa"));
          return (
            <section key={label} className="panel" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 6, height: "100%" }}>
              <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                {label}
              </span>
              <strong style={{ 
                fontSize: isErrorState ? 16 : 28, 
                fontWeight: 700, 
                letterSpacing: "-0.03em", 
                lineHeight: 1.2, 
                wordBreak: "break-word",
                color: label === "Kết quả vận hành" ? "var(--accent-bright)" : (isErrorState ? "var(--muted)" : "var(--fg)")
              }}>
                {value}
              </strong>
              <small style={{ fontSize: 12, color: "var(--muted)", opacity: 0.7, marginTop: "auto", paddingTop: 8 }}>
                {from} → {to}
              </small>
            </section>
          );
        })}
      </div>
      <p className="form-hint">
        Kết quả vận hành = doanh thu − giá vốn tại thời điểm bán − chi phí ghi
        nhận. Chưa trừ lương nếu chưa được ghi thành khoản chi.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 24, marginBottom: 24 }}>
        <section className="panel" style={{ overflow: "hidden" }}>
          <div className="section-toolbar">
            <h2>Doanh thu theo ngày</h2>
          </div>
          {days.length ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {days.slice().reverse().map((d, index, arr) => {
                const maxRev = Math.max(1, ...days.map(x => x.revenue));
                const pct = Math.max(2, (d.revenue / maxRev) * 100);
                const dayNum = d.day.slice(8, 10);
                const monthNum = d.day.slice(5, 7);
                return (
                  <div
                    key={d.day}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "44px 1fr auto",
                      alignItems: "center",
                      gap: 14,
                      padding: "11px 20px",
                      borderBottom: index < arr.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    {/* Date pill */}
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      background: "var(--raised)",
                      borderRadius: 8,
                      padding: "5px 4px",
                      lineHeight: 1.2,
                    }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)", fontVariantNumeric: "tabular-nums" }}>{dayNum}</span>
                      <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 500 }}>/{monthNum}</span>
                    </div>

                    {/* Progress bar + count */}
                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ height: 6, background: "var(--surface)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #ff9060))",
                          borderRadius: 4,
                          transition: "width 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>
                        {d.count} đơn
                      </span>
                    </div>

                    {/* Revenue */}
                    <div className="money" style={{ fontSize: 14, fontWeight: 650, color: "var(--fg)", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {money(d.revenue)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty">Chưa có giao dịch trong kỳ này.</p>
          )}
        </section>

        <section className="panel">
          <div className="section-toolbar">
            <h2>Sản phẩm bán chạy</h2>
          </div>
          {top.length ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {top.slice(0, 10).map((p, i) => {
                const maxTotal = Math.max(1, top[0].total);
                const pct = Math.max(2, (p.total / maxTotal) * 100);
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <div
                    key={p.name}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px 1fr auto",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 20px",
                      borderBottom: i < Math.min(top.length, 10) - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    {/* Rank */}
                    <span style={{ fontSize: i < 3 ? 16 : 12, textAlign: "center", color: i < 3 ? "inherit" : "var(--muted)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {i < 3 ? medals[i] : `${i + 1}`}
                    </span>

                    {/* Name + progress bar */}
                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 550, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 4, background: "var(--surface)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: i === 0
                              ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                              : i === 1
                                ? "linear-gradient(90deg, #94a3b8, #cbd5e1)"
                                : i === 2
                                  ? "linear-gradient(90deg, #b45309, #d97706)"
                                  : "var(--accent)",
                            borderRadius: 3,
                            transition: "width 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{p.quantity} cái</span>
                      </div>
                    </div>

                    {/* Revenue */}
                    <div className="money" style={{ fontSize: 13, fontWeight: 650, color: "var(--fg)", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {money(p.total)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty">Chưa có dữ liệu bán hàng.</p>
          )}
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 24, marginBottom: 24 }}>
        <section className="panel settings-form">
          <h2>Phương thức thanh toán</h2>
          <div className="summary-row">
            <span>Tiền mặt</span>
            <strong>{money(orders.reduce((n, o) => n + o.cash, 0))}</strong>
          </div>
          <div className="summary-row">
            <span>Chuyển khoản</span>
            <strong>{money(orders.reduce((n, o) => n + o.transfer, 0))}</strong>
          </div>
        </section>
        <section className="panel">
          <div className="section-toolbar">
            <h2>Doanh số nhân viên</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {data.members.map((m, i) => {
              const memberOrders = orders.filter((o) => o.user_id === m.id);
              const memberTotal = memberOrders.reduce((n, o) => n + o.total, 0);
              const maxMemberTotal = Math.max(1, ...data.members.map(mm =>
                orders.filter(o => o.user_id === mm.id).reduce((n, o) => n + o.total, 0)
              ));
              const pct = Math.max(2, (memberTotal / maxMemberTotal) * 100);
              return (
                <div
                  key={m.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 20px",
                    borderBottom: i < data.members.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <UserCircle size={13} style={{ color: "var(--muted)", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 550, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: "var(--surface)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: "var(--accent)",
                          borderRadius: 3,
                          transition: "width 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{memberOrders.length} đơn</span>
                    </div>
                  </div>
                  <div className="money" style={{ fontSize: 14, fontWeight: 650, color: "var(--fg)", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {money(memberTotal)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      {data.products.some((p) => p.stock < 0) && (
        <section className="panel settings-form">
          <h2>Cần đối soát tồn kho</h2>
          {data.products
            .filter((p) => p.stock < 0)
            .map((p) => (
              <p key={p.id} className="form-error">
                {p.name} · {p.sku}: {p.stock}
              </p>
            ))}
        </section>
      )}
    </>
  );
}
