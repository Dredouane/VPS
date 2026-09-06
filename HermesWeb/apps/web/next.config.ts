import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1 seul déploiement Cloud Run : le serveur Next embarque tout (front + API)
  output: "standalone",
};

export default nextConfig;
