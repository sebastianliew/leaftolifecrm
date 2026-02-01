/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Enable Next.js image optimization for better performance
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Set the frontend directory as the source for pages
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  webpack: (config, { isServer, dev }) => {
    // Disable source maps in development to avoid the current issue
    if (dev) {
      config.devtool = false;
    }

    // Use JS-based hash to avoid WasmHash crash on Node.js 22+
    config.output = {
      ...config.output,
      hashFunction: 'xxhash64',
    };

    config.module.rules.push({
      test: /\.afm$/,
      type: 'asset/source'
    });

    // Fix for mysql2 module resolution
    if (isServer) {
      config.externals = [...(config.externals || []), 'mysql2'];
    }

    return config;
  }
}

export default nextConfig
