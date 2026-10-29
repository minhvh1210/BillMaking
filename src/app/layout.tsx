import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { THEME_SCRIPT } from "@/components/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

export const metadata: Metadata = {
  title: "BillMaking",
  description: "Quản lý và chuẩn hóa chứng từ xuất nhập khẩu bằng AI",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme do THEME_SCRIPT đặt trước khi hydrate
    <html lang="vi" data-theme="light" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
