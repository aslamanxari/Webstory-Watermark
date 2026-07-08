import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AuraMark | Professional PDF Watermarking Platform",
  description: "Upload your PDFs, apply custom watermarks, and export high-quality WebP images in standard 4:5 aspect ratio instantly.",
  openGraph: {
    title: "AuraMark - Professional PDF Watermark Utility",
    description: "Convert pages of any PDF into beautiful 4:5 WebP images watermarked with your brand logo.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AuraMark - Professional PDF Watermark Utility",
    description: "Convert pages of any PDF into beautiful 4:5 WebP images watermarked with your brand logo.",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body 
        className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-[#0f172a] dark:text-slate-100 transition-colors duration-300"
        suppressHydrationWarning
      >
        <ThemeProvider>
          {children}
          <Toaster 
            position="bottom-right" 
            toastOptions={{
              style: {
                background: '#1e293b',
                color: '#fff',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
            }} 
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
