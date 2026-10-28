import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/Nav";
import { BRAND } from "@/lib/plans";

export const metadata: Metadata = {
  title: BRAND,
  description: "Best ball portfolio grades, exposure tracking, rankings and news.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
