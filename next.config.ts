import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

// versão do package.json (a release grava nele): aparece no "Sobre" do rodapé
let appVersion = "";
try { appVersion = JSON.parse(readFileSync("./package.json", "utf8")).version || ""; } catch { /* sem versão */ }

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: appVersion },
  /* config options here */
  allowedDevOrigins: ['www.veritumpro.com', 'veritumpro.com', 'localhost:3000'],
  serverExternalPackages: ['esbuild'],
} as any;

export default nextConfig;
