/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Deployed under report.propertygiant.com per the setup guide.
  // If instead served under a subpath (e.g. propertygiant.com/report),
  // uncomment and set basePath below.
  // basePath: '/report',

  // /check-in is iframed into propertygiant.com/check-in, and /report + /leads are
  // iframed into propertygiant.com/openhouse-report — explicitly allow framing from
  // those origins (Next sets no X-Frame-Options by default, but this documents intent
  // and survives any future host-level default that would otherwise block it).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://www.propertygiant.com https://propertygiant.com;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
