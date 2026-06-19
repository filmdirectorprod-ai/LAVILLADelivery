import type { Metadata, Viewport } from "next";
import { Poppins, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ToastViewport } from "@/components/Toast";
import { PWARegister } from "@/components/PWARegister";
import { EnablePush } from "@/components/EnablePush";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--ui-font",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "La Villa",
  description: "Commande La Villa — pâtisserie & restaurant à Fès",
  // Default (customer) PWA identity. The driver and admin segments override the
  // manifest + apple title via their own metadata exports.
  applicationName: "La Villa",
  manifest: "/manifest.client.webmanifest",
  appleWebApp: {
    capable: true,
    title: "La Villa",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/client-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/client-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/client-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#137c8b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${poppins.variable} ${playfair.variable}`}>
      <body>
        <div className="lv-frame">
          {children}
          <ToastViewport />
        </div>
        <PWARegister />
        <EnablePush />
      </body>
    </html>
  );
}
