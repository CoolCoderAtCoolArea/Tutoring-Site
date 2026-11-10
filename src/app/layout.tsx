import type { ReactNode } from "react";
import "./globals.css";

// The real <html> and <body> tags are in app/[locale]/layout.tsx,
// because the language (and text direction) depends on the URL.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
