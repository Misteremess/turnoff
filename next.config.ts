import type { NextConfig } from "next";

// Despliegue bajo un subdirectorio (ej. maximoduperez.com/turnoff): deja
// NEXT_PUBLIC_BASE_PATH vacío en local y a "/turnoff" en producción.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  basePath,
  // Genera un servidor Node.js autocontenido en .next/standalone, ideal
  // para correr con PM2 en un VPS/hosting propio.
  output: "standalone",
};

export default nextConfig;
