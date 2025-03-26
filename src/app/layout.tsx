import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProviderClient } from "@/components/ThemeProviderClient";
import { ProgressBarWrapper } from "@/components/ProgressBarWrapper";
import { Toaster } from "sonner";
import { LayoutProvider } from "@/contexts/LayoutContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VISTA - Vibe Into Software Tasks & Activities",
  description:
    "A context-aware work management dashboard that transforms traditional project tracking into an intuitive, vibe-based experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProviderClient>
          <LayoutProvider>
            <ProgressBarWrapper />
            <Toaster richColors position="top-right" />
            {children}
          </LayoutProvider>
        </ThemeProviderClient>
      </body>
    </html>
  );
}
