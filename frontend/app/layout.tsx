import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { ClerkProvider } from "@/lib/auth/clerk-provider";
import { Providers } from "@/components/providers/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Digest - Dashboard",
  description: "Manage your AI newsletter digest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Providers>
            {children}
            <Toaster position="bottom-right" />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
