import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {},
  allowedDevOrigins: ['localhost', '127.0.0.1', '*.127.0.0.1'],
};

// Conditionally apply Serwist only in production to avoid Turbopack conflict in dev
if (process.env.NODE_ENV === 'production') {
  const withSerwistInit = (await import('@serwist/next')).default;
  const withSerwist = withSerwistInit({
    swSrc: 'src/sw.ts',
    swDest: 'public/sw.js',
  });
  export default withSerwist(nextConfig);
} else {
  export default nextConfig;
}
