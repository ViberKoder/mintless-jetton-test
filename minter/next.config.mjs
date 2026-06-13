/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/jettons/:path*',
        destination: '/api/jettons/:path*',
      },
      {
        source: '/api/jettons/:master/merkle-dump.boc',
        destination: '/api/jettons/:master/merkle-dump',
      },
    ];
  },
};

export default nextConfig;
