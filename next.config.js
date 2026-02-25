/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Static building images are optimized by Next.js (WebP, resizing).
    // MLS photo proxy images use unoptimized prop on individual <Image> components
    // since their URLs are transient (~1hr expiry).
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
