import type { Metadata } from "next";
import "./globals.css";
import DataRefreshProvider from "./components/DataRefreshProvider";

export const metadata: Metadata = {
  title: "ResTrade | Trusted peer-to-peer commerce",
  description: "Buy and sell with confidence through protected escrow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <DataRefreshProvider>{children}</DataRefreshProvider>
      </body>
    </html>
  );
}
