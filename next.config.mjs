/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["mammoth", "unpdf"],
  allowedDevOrigins: [
    "*.e2b.app",
    "*.e2b.dev",
    "3000-ik9sf20e6l3nr89pe3a5o.e2b.app",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
        ],
      },
    ];
  },
};

export default nextConfig;
