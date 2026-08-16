import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";

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
    icon: "/icon-desktop-square.png",
  },
};
import { preinit } from "react-dom";
import { Providers } from "@/components/Providers";
import { cookies } from "next/headers";
import Script from "next/script";

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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (window.__TAURI_INTERNALS__ || window.__TAURI__ || window.__TAURI_IPC__) {
                document.documentElement.classList.add('is-tauri');
                
                // Força o logout na IDE a cada vez que ela é fechada e reaberta.
                if (!sessionStorage.getItem('ide_started')) {
                  sessionStorage.setItem('ide_started', 'true');
                  
                  // Clear localStorage
                  const keys = Object.keys(localStorage);
                  for (const key of keys) {
                    if (key.startsWith('sb-') && key.includes('-auth-token')) {
                      localStorage.removeItem(key);
                    }
                  }
                  
                  // Clear Cookies
                  const cookies = document.cookie.split(';');
                  for (let i = 0; i < cookies.length; i++) {
                    const cookie = cookies[i].trim();
                    if (cookie.startsWith('sb-') && cookie.includes('-auth-token')) {
                      const name = cookie.split('=')[0];
                      document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    }
                  }
                }
              }
            `
          }}
        />
        <Script
          id="oauth-redirect"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
            try {
              // Capturar código de indicação do iClub
              const urlParams = new URLSearchParams(window.location.search);
              const ref = urlParams.get('ref');
              if (ref) {
                document.cookie = 'iclub_ref_code=' + encodeURIComponent(ref) + '; path=/; max-age=604800; SameSite=Lax';
              }

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
          }}
        />
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
