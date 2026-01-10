/**
 * Minimal Next.js config for prototype.
 * Keep explicit and simple; no experimental flags.
 */
module.exports = {
  reactStrictMode: true,
  async rewrites() {
    // Proxy /api/* requests to the local API during development so the
    // Next.js app can call the backend without CORS configuration by
    // using a relative path (e.g., fetch('/api/uploads')). The endpoint
    // is configurable via `API_ENDPOINT` so the dev container can proxy
    // to the `api` service (e.g., http://api:4000) while local dev can
    // default to http://localhost:4000.
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: `${process.env.API_ENDPOINT || 'http://localhost:4000'}/:path*`,
        },
      ],
    }
  },
}
