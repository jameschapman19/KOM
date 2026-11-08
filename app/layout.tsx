import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "KOM Finder", description: "Loop routes through KOMs you can actually take" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
