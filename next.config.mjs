/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  async redirects() {
    return [
      {
        source: '/icons/icon-192.png',
        destination: '/icons/icon-192.svg',
        permanent: false,
      },
      {
        source: '/icons/icon-512.png',
        destination: '/icons/icon-512.svg',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
