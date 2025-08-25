import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers/providers";
import { ClerkProvider } from "@/lib/auth/clerk-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Digest - Turn 50+ AI Newsletters Into One Weekly Summary",
  description:
    "Save 3+ hours weekly. AI Digest automatically summarizes your AI/tech newsletters with role-specific insights and product opportunities. Start free.",
  keywords:
    "AI newsletter summarizer, email digest tool, newsletter aggregator, AI email summary, newsletter fatigue solution, tech newsletter digest",
  authors: [{ name: "AI Digest" }],
  openGraph: {
    title: "AI Digest - Turn Newsletter Chaos Into Weekly Insights",
    description:
      "Stop drowning in AI newsletters. Get intelligent summaries with actionable insights delivered every Sunday. Save 3+ hours weekly.",
    url: "https://ai-digest.app",
    siteName: "AI Digest",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AI Digest - Your AI Newsletter Summarizer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Digest - Turn 50+ AI Newsletters Into One Weekly Summary",
    description:
      "Save 3+ hours weekly with intelligent AI newsletter summaries. Role-specific insights included.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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
