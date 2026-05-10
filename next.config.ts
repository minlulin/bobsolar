import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV !== 'production',
});

const nextConfig: NextConfig = {
  turbopack: {},
  allowedDevOrigins: ['localhost', '127.0.0.1', '*.127.0.0.1'],
};

export default withSerwist(nextConfig);
