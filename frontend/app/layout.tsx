import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resilient Job Platform",
  description: "Async file processing platform — upload, process, and inspect results in real-time.",
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
