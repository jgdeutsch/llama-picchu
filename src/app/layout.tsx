import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Llama at Machu Picchu",
  description: "A text adventure game in the style of Rosencrantz and Guildenstern Are Dead. You are a llama navigating Machu Picchu during the Incan era.",
  keywords: ["text adventure", "game", "llama", "machu picchu", "inca", "zork"],
  openGraph: {
    title: "🦙 Llama at Machu Picchu",
    description: "A philosophical text adventure. You are a llama. The rest is uncertain.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jetbrainsMono.variable} font-mono antialiased`}>
        {children}
      </body>
    </html>
  );
}
