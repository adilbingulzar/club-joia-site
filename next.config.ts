import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  // Old static-site addresses (shared links, payment success URLs) keep working.
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/:page(tickets|summary|thank-you|ruby-red|pearly-white|ultra-black).html', destination: '/:page', permanent: true }
    ];
  }
};

export default nextConfig;
