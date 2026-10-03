import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",").filter(Boolean) ?? [],
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
