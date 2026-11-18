/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  experimental: {

    serverComponentsExternalPackages: ["imapflow", "mailparser"],
    outputFileTracingIncludes: {
      "/api/dataroom-file/[file]": ["./dataroom-files/**/*"]
    }
  },

  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  }
};
