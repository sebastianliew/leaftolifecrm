/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Set the frontend directory as the source for pages
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // Use legacy webpack instead of Turbopack for stability
  experimental: {
    turbo: false,
  },
  // Disable source maps in development to avoid the error
  devIndicators: {
    buildActivity: false,
  },
  webpack: (config, { isServer, dev }) => {
    // Disable source maps in development to avoid the current issue
    if (dev) {
      config.devtool = false;
    }
    
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
