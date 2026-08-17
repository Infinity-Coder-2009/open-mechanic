import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenMechanic — AI-Powered Hardware Engineering Co-Pilot",
  description: "Multi-agent AI system for mechanical, electrical, and thermal design. Generate CAD, run simulations, and produce manufacturing-ready designs.",
  keywords: ["CAD", "engineering", "AI", "mechanical design", "hardware", "simulation", "manufacturing"],
  authors: [{ name: "OpenMechanic Contributors" }],
  creator: "OpenMechanic",
  publisher: "OpenMechanic",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://openmechanic.dev",
    siteName: "OpenMechanic",
    title: "OpenMechanic — AI-Powered Hardware Engineering Co-Pilot",
    description: "Multi-agent AI system for mechanical, electrical, and thermal design.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "OpenMechanic Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenMechanic",
    description: "AI-Powered Hardware Engineering Co-Pilot",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0A0F1A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" toastOptions={{ className: "glass-card" }} />
          <Sonner position="top-right" toastOptions={{ className: "glass-card" }} />
        </ThemeProvider>
      </body>
    </html>
  );
}