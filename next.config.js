/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: '/44-east-avenue',
        destination: '/downtown-condos/44-east',
        permanent: true,
      },
      {
        source: '/44-east-avenue/:path*',
        destination: '/downtown-condos/44-east/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
