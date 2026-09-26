"use client";
import type { Product } from "@/lib/types";
import { Field } from "@/components/ui";

export function ProductFields({ product: p }: { product: Product | null }) {
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
        <input name="variant" required placeholder="Đen / M" defaultValue={p?.variant} />
      </Field>
      <div className="form-grid">
        <Field label="Giá bán (₫)">
          <input name="price" type="number" min="0" required defaultValue={p?.price} />
        </Field>
        <Field label="Giá vốn (₫)">
          <input name="cost" type="number" min="0" required defaultValue={p?.cost} />
        </Field>
        <Field label={p ? "Tồn kho (điều chỉnh riêng)" : "Tồn kho ban đầu"}>
          <input name="stock" type="number" min="0" readOnly={!!p} defaultValue={p?.stock || 0} />
        </Field>
        <Field label="Màu sản phẩm">
          <input name="color" type="color" defaultValue={p?.color || "#676b63"} />
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
