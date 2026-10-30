import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Anton } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isProductionDeployment, getSiteUrl } from "@/lib/site-url";

import "./globals.css";

const siteUrl = getSiteUrl();
const description =
  "Hamburguesas, perros calientes y papas a domicilio en Valledupar. Pide por WhatsApp y paga en efectivo o por transferencia.";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TETSU BURGER | Hamburguesas a domicilio en Valledupar",
    template: "%s | TETSU BURGER",
  },
  description,
  applicationName: "TETSU BURGER",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: "/",
    siteName: "TETSU BURGER",
    title: "TETSU BURGER | Hamburguesas a domicilio en Valledupar",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "TETSU BURGER | Hamburguesas a domicilio en Valledupar",
    description,
  },
  robots: isProductionDeployment()
    ? undefined
    : { index: false, follow: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icons/tab-icon.png", type: "image/png", sizes: "256x256" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "TETSU BURGER",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ff6633",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-CO"
      className={`${jakarta.variable} ${anton.variable}`}
    >
      <body>
        <TooltipProvider delayDuration={150}>
          {children}
          <Toaster richColors position="top-center" />
          <Analytics />
          <SpeedInsights />
        </TooltipProvider>
      </body>
    </html>
  );
}
