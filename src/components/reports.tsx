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
                background: from === businessDay(new Date(Date.parse(today + "T12:00:00+07:00") - 6 * 86400000).toISOString()) && to === today ? "var(--bg)" : "transparent",
                color: from === businessDay(new Date(Date.parse(today + "T12:00:00+07:00") - 6 * 86400000).toISOString()) && to === today ? "var(--fg)" : "var(--muted)",
                boxShadow: from === businessDay(new Date(Date.parse(today + "T12:00:00+07:00") - 6 * 86400000).toISOString()) && to === today ? "0 2px 5px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)" : "none",
                border: "none", padding: "6px 14px", borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "background 200ms ease-out, color 200ms ease-out, box-shadow 200ms ease-out" 
              }}
              onClick={() => {
                setFrom(
                  businessDay(
                    new Date(
                      Date.parse(today + "T12:00:00+07:00") - 6 * 86400000,
                    ).toISOString(),
                  ),
                );
                setTo(today);
              }}
            >
              7 ngày
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
            Tải CSV
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginBottom: 24 }}>
        <section className="panel" style={{ overflow: "hidden" }}>
          <div className="section-toolbar">
            <h2>Doanh thu theo ngày</h2>
          </div>
          {days.length ? (
            <>
              <div style={{ overflowX: "auto", margin: "0 -20px", padding: "0 20px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
                <div className="bar-chart" aria-hidden="true" style={{ minWidth: Math.max(days.slice(-14).length * 40, 500) }}>
                  {days.slice(-14).map((d) => (
                    <div className="bar-column" key={d.day}>
                      <span style={{ whiteSpace: "nowrap" }}>{money(d.revenue)}</span>
                      <div
                        className="bar"
                        style={{
                          height: Math.max(
                            3,
                            (d.revenue /
                              Math.max(1, ...days.map((x) => x.revenue))) *
                              150,
                          ),
                          width: "100%",
                          maxWidth: 32,
                          margin: "0 auto",
                          background: "var(--accent)",
                          borderRadius: "4px 4px 0 0"
                        }}
                      />
                      <small>{d.day.slice(5)}</small>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", marginTop: 24 }}>
                <div style={{ display: "flex", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <div style={{ flexBasis: 50, flexShrink: 0 }}>Ngày</div>
                  <div style={{ flex: 1, paddingLeft: 16 }}>Biểu đồ & Số đơn</div>
                  <div style={{ flexBasis: 110, flexShrink: 0, textAlign: "right" }}>Doanh thu</div>
                </div>

                {days.slice().reverse().map((d, index, arr) => {
                  const maxRev = Math.max(1, ...days.map(x => x.revenue));
                  const percent = Math.max(1, (d.revenue / maxRev) * 100);
                  
                  return (
                    <div key={d.day} style={{ display: "flex", alignItems: "center", padding: "14px 0", borderBottom: index < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                      
                      <div style={{ flexBasis: 50, flexShrink: 0, fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                        {d.day.slice(8,10)}/{d.day.slice(5,7)}
                      </div>
                      
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, padding: "0 16px" }}>
                        <div style={{ flex: 1, maxWidth: 160, height: 6, background: "var(--surface)", borderRadius: 4, overflow: "hidden" }}>
                           <div style={{ height: "100%", width: "100%", transform: `scaleX(${percent / 100})`, transformOrigin: "left", background: "var(--accent)", borderRadius: 4, transition: "transform 400ms cubic-bezier(0.16, 1, 0.3, 1)" }} />
                        </div>
                        <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500, flexShrink: 0 }}>
                          {d.count} đơn
                        </span>
                      </div>

                      <div className="money" style={{ flexBasis: 110, flexShrink: 0, textAlign: "right", fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>
                        {money(d.revenue)}
                      </div>

                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="empty">Chưa có giao dịch trong kỳ này.</p>
          )}
        </section>
        <section className="panel">
          <div className="section-toolbar">
            <h2>Sản phẩm bán chạy</h2>
          </div>
          <div className="table-wrap" data-table="terminal">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Đã bán</th>
                  <th>Doanh thu</th>
                </tr>
              </thead>
              <tbody>
                {top.slice(0, 20).map((p) => (
                  <tr key={p.name}>
                    <td data-label="Sản phẩm">{p.name}</td>
                    <td data-label="Đã bán">{p.quantity}</td>
                    <td className="money" data-label="Doanh thu">{money(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginBottom: 24 }}>
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
          <div className="table-wrap" data-table="terminal">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Số đơn</th>
                  <th>Doanh số</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.id}>
                    <td data-label="Nhân viên">
                      <span className="badge">
                        <UserCircle size={14} />
                        {m.name}
                      </span>
                    </td>
                    <td data-label="Số đơn">{orders.filter((o) => o.user_id === m.id).length}</td>
                    <td className="money" data-label="Doanh số">
                      {money(
                        orders
                          .filter((o) => o.user_id === m.id)
                          .reduce((n, o) => n + o.total, 0),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
