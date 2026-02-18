/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/downtown-condos',
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: '/44-east-avenue',
        destination: '/44-east',
        permanent: true,
      },
      {
        source: '/44-east-avenue/:path*',
        destination: '/44-east/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
