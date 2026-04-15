import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "./components/ThemeProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Collector Pro — YouTube Music Downloader",
  description:
    "Download YouTube Music to high-quality MP3 with full metadata tagging. Supports playlists, albums, and single videos. 320kbps stereo 48kHz output.",
  keywords: [
    "YouTube Music",
    "MP3 downloader",
    "playlist downloader",
    "music converter",
    "yt-dlp",
  ],
  authors: [{ name: "Collector Pro" }],
  openGraph: {
    title: "Collector Pro — YouTube Music Downloader",
    description:
      "Download YouTube Music to high-quality MP3 with full metadata. 320kbps · Stereo · 48kHz.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
