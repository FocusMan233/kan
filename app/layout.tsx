import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: { default: "Kan — la voix de nos langues", template: "%s · Kan" },
  description:
    "Kan rassemble les voix du mooré et du dioula. Lis, traduis, écoute : chaque contribution validée est rémunérée.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Kan", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0e5a3a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
