import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CanvasLayer from "../components/canvas/CanvasLayer";
import ScrollProvider from "./scroll-provider";
import Cursor from "../components/Cursor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Synapse — Independent AI Studio";
const description =
  "Synapse makes thoughtful digital experiences for a world that won't sit still.";

// Absolute base for share URLs (OG image etc.). On Vercel, the production domain is
// provided automatically; locally it falls back to the dev server.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "Synapse",
  keywords: ["AI studio", "AI experiences", "digital products", "creative technology"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Synapse",
    title,
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#05060a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CanvasLayer />
        <ScrollProvider>{children}</ScrollProvider>
        <Cursor />
      </body>
    </html>
  );
}
