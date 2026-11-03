import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Alias "@/..." explicite (en plus de tsconfig) pour que le build ne dépende pas de la détection automatique.
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, "@": root };
    return config;
  },
};
export default nextConfig;
