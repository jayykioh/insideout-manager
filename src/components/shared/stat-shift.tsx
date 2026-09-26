"use client";
import type { Snapshot } from "@/lib/types";
import { date, expectedCash, money } from "@/lib/domain";
import { Empty } from "@/components/ui";

export function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <section className="panel stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}

export function ShiftTable({ data, onApprove }: { data: Snapshot; onApprove: (id: string) => void }) {
  return (
    <section className="panel">
      <div className="section-toolbar">
        <h2>Đối soát ca làm</h2>
      </div>
      {!data.shifts.length ? (
        <Empty title="Chưa có ca làm" detail="Ca làm sẽ xuất hiện sau khi chấm công vào." />
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
                  <td>{data.members.find((m) => m.id === s.user_id)?.name || "Bạn"}</td>
                  <td>{date(s.started_at)}</td>
                  <td>{s.ended_at ? date(s.ended_at) : "Đang làm"}</td>
                  <td className="money">{money(s.expected_cash ?? expectedCash(s, data.orders))}</td>
                  <td className="money">{s.actual_cash === null ? "—" : money(s.actual_cash)}</td>
                  <td className="money">{s.actual_cash === null ? "—" : money(s.actual_cash - (s.expected_cash || 0))}</td>
                  <td>
                    {s.status === "submitted" && data.user.role === "admin" ? (
                      <button className="secondary" onClick={() => onApprove(s.id)}>Duyệt ca</button>
                    ) : (
                      <span className="badge">
                        {s.status === "open" ? "Đang mở" : s.status === "approved" ? "Đã duyệt" : "Chờ duyệt"}
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
