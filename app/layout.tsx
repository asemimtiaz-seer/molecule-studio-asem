import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Molecule — Structure Studio",
  description: "Draw, inspect, and explore molecular structures in 2D and 3D. A precise, browser-based chemistry workspace.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
