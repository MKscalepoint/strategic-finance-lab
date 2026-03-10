import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strategic Finance Lab",
  description:
    "Guided strategic finance analysis for growth company leaders.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
