import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: "USC Private Events & Conferences",
    template: "%s · USC Private Events & Conferences",
  },
  description:
    "Banquet operations platform for USC Private Events & Conferences — staff scheduling, BEO management, and venue operations.",
  applicationName: "USC Private Events & Conferences",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#990000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
