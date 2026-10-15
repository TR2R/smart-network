import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "رَصْد | نظام مراقبة الشبكة الذكي",
  description: "رَصْد: لوحة ذكية لمراقبة الأجهزة والمنافذ وحركة الشبكة والتنبيهات والاتصال الاحتياطي.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
