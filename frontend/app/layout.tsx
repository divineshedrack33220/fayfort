import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";
import { VitalsMonitor } from "@/components/performance/web-vitals";
import { ServiceWorkerProvider } from "@/components/pwa/service-worker-provider";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { SITE_URL } from "@/lib/site-config";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Fayfort Sourcing — China sourcing for African businesses",
    template: "%s | Fayfort Sourcing",
  },
  description:
    "Know what your China purchase will really cost before you buy. Estimate your landed cost, understand your margins, and let Fayfort help you source with confidence.",
  applicationName: "Fayfort Sourcing",
  keywords: ["china sourcing", "landed cost", "africa import", "procurement", "freight"],
  category: "business",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Fayfort",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    siteName: "Fayfort Sourcing",
    title: "Fayfort Sourcing — Know what your China purchase will really cost",
    description:
      "Estimate your landed cost, understand your margins, then request, quote and track shipments. Fayfort sources from China for African businesses with transparent pricing.",
    url: "/",
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    site: "@fayfort",
    title: "Fayfort Sourcing",
    description:
      "Know what your China purchase will really cost before you buy.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: "#031a45",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Fayfort International Trading",
  description:
    "China-to-Africa sourcing with transparent landed costs — estimates, verified suppliers, quotes and shipment tracking.",
  url: SITE_URL,
  sameAs: [],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <ServiceWorkerProvider>
          {children}
          <InstallPrompt />
        </ServiceWorkerProvider>
        <VitalsMonitor />
        <Toaster />
      </body>
    </html>
  );
}
