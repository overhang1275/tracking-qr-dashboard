import type { NextConfig } from "next";
const config: NextConfig = {
  images: { unoptimized: true },
  allowedDevOrigins: ["127.0.0.1","colima.computerform.com.mx"],
};
export default config;
