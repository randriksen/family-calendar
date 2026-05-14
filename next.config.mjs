import { readFileSync } from 'fs';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

export default nextConfig;
