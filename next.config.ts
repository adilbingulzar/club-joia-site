import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  // the ticket shop's email (pg and @node-rs/argon2 are left out of the bundle by Next itself)
  serverExternalPackages: ['nodemailer', 'mysql2'],
  // Old static-site addresses (shared links, payment success URLs) keep working.
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/:page(tickets|summary|thank-you|ruby-red|pearly-white|ultra-black).html', destination: '/:page', permanent: true }
    ];
  },
  // Ticket emails link to this site: their PDF, QR code and images come from the server holding the tickets.
  async rewrites() {
    const server = (process.env.ALFRED_UAE_URL || '').replace(/\/+$/, '');
    if (!server) return [];
    return ['/booking_events/pdf/:path', '/Ajaxdorian/getQrcodeImage/:path', '/uploads/qrcodes/:path', '/assets/:path*', '/ticketing/download', '/downloadticketpdf/:path'].map(function (source) {
      return { source, destination: server + source };
    });
  }
};

export default nextConfig;
