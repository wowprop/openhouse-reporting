import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open House Reporting | PropertyGiant",
  description: "Internal weekly reporting and lead tracking for the PropertyGiant open house team.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
