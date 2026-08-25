import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";

const SITE_URL = "https://maar-student-hub.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MAAR Study Hub",
    template: "%s · MAAR Study Hub",
  },
  description:
    "Discover what you struggle with, learn it properly, and track your improvement — a personalised study space for Maths and English.",
  applicationName: "MAAR Study Hub",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MAAR Study Hub",
  },
  openGraph: {
    title: "MAAR Study Hub",
    description:
      "A personalised study space that finds what you struggle with, teaches it properly, and tracks your improvement.",
    url: SITE_URL,
    siteName: "MAAR Study Hub",
    locale: "en_GB",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
  // Add your Google Search Console verification code here once you have one
  // (Search Console → Settings → Ownership verification → HTML tag method):
  // verification: { google: "your-verification-code-here" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f6f1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
