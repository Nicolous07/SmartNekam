import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeInitializer from "@/components/layout/ThemeInitializer";
import SmartNekamInstallPrompt from "@/components/pwa/SmartNekamInstallPrompt";

export const metadata: Metadata = {
  title: "SmartNekam",
  description:
    "Jukwaa la elimu, maktaba, jamii za shule na fursa kwa wanafunzi wa Afrika Mashariki.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/images/smartnekam-mark.png", apple: "/apple-touch-icon.png" },
  openGraph: { title: "SmartNekam", description: "Learn • Connect • Grow — Jukwaa la elimu, jamii na fursa.", images: ["/images/smartnekam-logo.png"] },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "SmartNekam" },
};

export const viewport: Viewport = {
  themeColor: "#0B0F1A",
};


export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sw" className="dark" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeInitializer />
        <SmartNekamInstallPrompt />
        {children}
      </body>
    </html>
  );
}
