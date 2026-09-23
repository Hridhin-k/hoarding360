import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HOARDINGS360",
  description: "Operating system for outdoor media — Manage, Market, Field",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-body) mx-[40px]]">
        {children}
      </body>
    </html>
  );
}
