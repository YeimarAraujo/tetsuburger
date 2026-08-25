import type { Metadata } from "next";
import { Geist_Mono, Bebas_Neue } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TETSUBURGER",
  description:
    "Las mejores hamburguesas artesanales y perros calientes de la ciudad. Pide por WhatsApp.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${bebas.variable} ${geistMono.variable}`}
      >
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
