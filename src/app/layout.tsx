import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeInitializer from "@/components/layout/ThemeInitializer";

export const metadata: Metadata = {
  title: "SmartNekam",
  description:
    "Jukwaa la elimu, maktaba, jamii za shule na fursa kwa wanafunzi wa Afrika Mashariki.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/images/smartnekam-mark.png", apple: "/images/smartnekam-mark.png" },
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <ThemeInitializer />
        {children}
      </body>
    </html>
  );
}
