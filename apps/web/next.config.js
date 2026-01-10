/**
 * Minimal Next.js config for prototype.
 * Keep explicit and simple; no experimental flags.
 */
module.exports = {
  reactStrictMode: true,
  async rewrites() {
    // Proxy /api/* requests to the local API during development so the
    // Next.js app can call the backend without CORS configuration by
    // using a relative path (e.g., fetch('/api/uploads')).
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: 'http://localhost:4000/:path*',
        },
      ],
    }
  },
}
