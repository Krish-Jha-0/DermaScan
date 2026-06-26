/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        // Automatically redirects any front-end fetch to the local running python instance
        source: '/api/scan',
        destination: 'http://127.0.0.1:5000/api/scan',
      },
    ];
  },
};

export default nextConfig;