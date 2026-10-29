"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "@/components/icons";

export type MoreMenuItem = { label: string; icon: IconName; danger?: boolean; onSelect: () => void };

const MENU_WIDTH = 180;
const GAP = 4;

/**
 * Nút "…" mở menu thao tác. Quy ước của app: Đổi tên và Xóa luôn nằm trong menu này.
 * Menu render qua portal lên <body> với vị trí fixed, để không bị khung cha có
 * overflow-hidden (danh sách bo góc) cắt mất, cũng không bị nút của dòng khác đè lên.
 */
export function MoreMenu({ items, label }: { items: MoreMenuItem[]; label: string }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = position !== null;

  function place() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    // Mặc định mở xuống dưới, căn mép phải với nút; sát đáy màn hình thì mở lên trên
    const below = rect.bottom + GAP;
    const top = below + menuHeight > window.innerHeight - 8 && menuHeight > 0 ? rect.top - GAP - menuHeight : below;
    setPosition({ top, left: Math.max(8, rect.right - MENU_WIDTH) });
  }

  // Đo lại sau khi menu hiện ra để biết chiều cao thật
  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    // Cuộn trang (kể cả khung con) thì đóng menu, tránh menu trôi lệch khỏi nút
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    // Chặn click/double-click lan ra dòng cha (dòng có thể mở trang khi double-click)
    <div className="relative" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="icon-btn"
        onClick={() => (open ? setPosition(null) : place())}
      >
        <Icon name="ellipsis" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
            className="fixed z-50 flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`flex items-center gap-3 rounded px-3 py-2 text-left text-sm hover:bg-surface-sunken ${
                  item.danger ? "text-error-ink" : "text-ink"
                }`}
                onClick={() => {
                  setPosition(null);
                  item.onSelect();
                }}
              >
                <Icon name={item.icon} />
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
