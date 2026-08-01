import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@licitacat/shared', '@licitacat/auth', '@licitacat/db'],
  async rewrites() {
    // In local development, proxy Better Auth through the local Next server.
    // This keeps its session cookie on localhost and avoids browser CORS
    // restrictions while the production database remains on the VPS.
    if (process.env.LOCAL_DEV_USE_REMOTE_AUTH === 'true' && process.env.REMOTE_AUTH_URL) {
      return {
        beforeFiles: [
          {
            source: '/api/auth/:path*',
            destination: `${process.env.REMOTE_AUTH_URL}/api/auth/:path*`,
          },
        ],
      }
    }

    return []
  },
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  webpack: (config) => {
    // Allows TypeScript workspace packages to use `.js` extensions in imports
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    }
    return config
  },
}

export default nextConfig
