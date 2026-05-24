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
    icon: "/logo-crystal.png",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              // Se o Supabase rejeitar a URL de callback (ex: falta de configuração no painel),
              // ele faz fallback para a URL base (/). Se isso acontecer no popup e tiver um código OAuth,
              // interceptamos e forçamos o redirecionamento para o callback correto.
              if (window.opener && window.opener !== window) {
                if (window.location.pathname === '/' && window.location.search.includes('code=')) {
                  window.location.href = '/auth/callback' + window.location.search;
                }
              }
            } catch (e) {}
          `
        }} />
      </head>
      <body 
        className="min-h-full flex flex-col bg-white dark:bg-black text-black dark:text-white transition-colors duration-300"
        suppressHydrationWarning
      >
        <Providers initialLocale={locale as any}>
          {children}
          {modal}
        </Providers>
      </body>
    </html>
  );
}
