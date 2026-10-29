"use client";

import { useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "bm-theme";

export const THEME_OPTIONS: { id: ThemeChoice; label: string; description: string }[] = [
  { id: "light", label: "Sáng", description: "Nền sáng, dễ đọc chứng từ trong văn phòng." },
  { id: "dark", label: "Tối", description: "Nền tối, dịu mắt khi làm việc lâu." },
  { id: "system", label: "Theo hệ thống", description: "Tự đổi theo cài đặt sáng / tối của máy tính." },
];

/** Chạy trước khi trang hiện ra để không bị nháy theme sáng khi người dùng chọn tối */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}")||"light";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

function readChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "system" ? value : "light";
  } catch {
    return "light";
  }
}

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** Theme lưu trong trình duyệt, áp dụng ngay khi đổi (không cần bấm Lưu) */
export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>("light");

  useEffect(() => {
    // Đọc lựa chọn đã lưu sau khi mount; server luôn render giá trị mặc định
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(readChoice());
  }, []);

  useEffect(() => {
    if (choice !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  return [
    choice,
    (next) => {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Trình duyệt chặn lưu trữ: vẫn đổi theme cho phiên hiện tại
      }
      apply(next);
      setChoice(next);
    },
  ];
}
