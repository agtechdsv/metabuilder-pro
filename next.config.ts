import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['www.veritumpro.com', 'veritumpro.com', 'localhost:3000'],
  serverExternalPackages: ['esbuild'],
} as any;

export default nextConfig;
