import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "USC T&G Banquet Operations",
  description: "Banquet staff scheduling & BEO management for USC Town and Gown.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
