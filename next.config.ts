import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  // the ticket shop's email (pg and @node-rs/argon2 are left out of the bundle by Next itself)
  serverExternalPackages: ['nodemailer', 'mysql2', 'postmark'],
  // Old static-site addresses (shared links, payment success URLs) keep working.
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/:page(tickets|summary|thank-you|ruby-red|pearly-white|ultra-black).html', destination: '/:page', permanent: true },
      // the privacy notice is at /privacy
      { source: '/preregister/privacy.html', destination: '/privacy', permanent: true }
    ];
  },
  async rewrites() {
    // the pre-registration page's privacy notice (public/preregister/privacy.html) at /privacy
    const own = [{ source: '/privacy', destination: '/preregister/privacy.html' }];
    // Ticket emails link to this site: their PDF, QR code and images come from the server holding the tickets.
    const server = (process.env.ALFRED_UAE_URL || '').replace(/\/+$/, '');
    if (!server) return own;
    return own.concat(['/booking_events/pdf/:path', '/Ajaxdorian/getQrcodeImage/:path', '/uploads/qrcodes/:path', '/assets/:path*', '/ticketing/download', '/downloadticketpdf/:path'].map(function (source) {
      return { source, destination: server + source };
    }));
  }
};

export default nextConfig;
