/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', 
  basePath: '/v0-shift-management-app',
  assetPrefix: '/v0-shift-management-app/',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
