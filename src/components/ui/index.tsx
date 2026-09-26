"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { ShoppingBag, X } from "lucide-react";
import Image from "next/image";
import type { Product } from "@/lib/types";

/* ─── IconButton ─────────────────────────────────────────── */
export function IconButton({
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

/* ─── Empty State ────────────────────────────────────────── */
export function Empty({
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

/* ─── Form Field ─────────────────────────────────────────── */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/* ─── Modal Dialog ───────────────────────────────────────── */
export function Modal({
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

/* ─── Product Artwork ────────────────────────────────────── */
export function ProductArt({
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

