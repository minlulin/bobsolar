import withBundleAnalyzerInit from '@next/bundle-analyzer';

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1', '*.127.0.0.1'],
};

const withBundleAnalyzer = withBundleAnalyzerInit({
  enabled: process.env.ANALYZE === 'true',
});

// Conditionally apply Serwist only in production to avoid Turbopack conflict in dev.
export default async function getNextConfig() {
  let config = nextConfig;
  if (process.env.NODE_ENV !== 'production') {
    config = { ...config, turbopack: {} };
  } else {
    const { default: withSerwistInit } = await import('@serwist/next');
    const withSerwist = withSerwistInit({
      swSrc: 'src/sw.ts',
      swDest: 'public/sw.js',
    });
    config = withSerwist(config);
  }
  return withBundleAnalyzer(config);
}
