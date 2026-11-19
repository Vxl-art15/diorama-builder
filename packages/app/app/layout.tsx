import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VIOLET",
  description: "A 3D village where teams of AI agents work on your projects",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
