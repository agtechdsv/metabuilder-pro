import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MetaBuilderPRO | The Dynamic Metadata Engine",
  description: "Generate dynamic database-driven CRUD applications without physical file generation.",
  icons: {
    icon: [
      {
        url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%234f46e5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
        type: 'image/svg+xml',
      },
    ],
  },
};
import { preinit } from "react-dom";
import { Providers } from "@/components/Providers";
import { cookies } from "next/headers";

export default async function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  // Oficial React 19 API to inject scripts into the head without triggering component tree warnings
  preinit("/theme-init.js", { as: "script" });

  const cookieStore = await cookies();
  const locale = cookieStore.get("app-language")?.value || "pt";

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head />
      <body className="min-h-full flex flex-col bg-white dark:bg-black text-black dark:text-white transition-colors duration-300">
        <Providers initialLocale={locale as any}>
          {children}
          {modal}
        </Providers>
      </body>
    </html>
  );
}
