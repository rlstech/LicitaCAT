/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@licitacat/shared'],
  experimental: {
    serverComponentsExternalPackages: [],
  },
}

export default nextConfig
