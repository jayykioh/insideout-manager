"use client";
import { useState } from "react";
import { Download } from "lucide-react";
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
        <div className="row-actions">
          <button
            className="secondary"
            onClick={() => {
              setFrom(today);
              setTo(today);
            }}
          >
            Hôm nay
          </button>
          <button
            className="secondary"
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
            className="secondary"
            onClick={() => {
              setFrom(today.slice(0, 7) + "-01");
              setTo(today);
            }}
          >
            Tháng này
          </button>
          <button className="secondary" onClick={exportCsv}>
            <Download size={16} />
            CSV
          </button>
        </div>
      </div>
      <div className="stats-grid">
        {figures.map(([label, value]) => (
          <section key={label} className="panel stat">
            <span>{label}</span>
            <strong>{value}</strong>
            <small>
              {from} → {to}
            </small>
          </section>
        ))}
      </div>
      <p className="form-hint">
        Kết quả vận hành = doanh thu − giá vốn tại thời điểm bán − chi phí ghi
        nhận. Chưa trừ lương nếu chưa được ghi thành khoản chi.
      </p>
      <div className="report-grid">
        <section className="panel">
          <div className="section-toolbar">
            <h2>Doanh thu theo ngày</h2>
          </div>
          {days.length ? (
            <>
              <div className="bar-chart" aria-hidden="true">
                {days.slice(-14).map((d) => (
                  <div className="bar-column" key={d.day}>
                    <span>{money(d.revenue)}</span>
                    <div
                      className="bar"
                      style={{
                        height: Math.max(
                          3,
                          (d.revenue /
                            Math.max(1, ...days.map((x) => x.revenue))) *
                            150,
                        ),
                      }}
                    />
                    <small>{d.day.slice(5)}</small>
                  </div>
                ))}
              </div>
              <div className="table-wrap" data-table="terminal">
                <table className="report-table">
                  <caption className="sr-only">
                    Số liệu doanh thu theo ngày tương ứng biểu đồ
                  </caption>
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Số đơn</th>
                      <th>Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d) => (
                      <tr key={d.day}>
                        <td data-label="Ngày">{d.day}</td>
                        <td data-label="Số đơn">{d.count}</td>
                        <td className="money" data-label="Doanh thu">{money(d.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
      <div className="report-grid">
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
                    <td data-label="Nhân viên">{m.name}</td>
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
