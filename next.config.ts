import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.ipfs.dweb.link" },
      { protocol: "https", hostname: "**.ipfs.io" },
      { protocol: "https", hostname: "euc.li" },
      { protocol: "https", hostname: "metadata.ens.domains" },
      { protocol: "https", hostname: "**.arweave.net" },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["xrpl", "grammy"],
  },
}

export default nextConfig
