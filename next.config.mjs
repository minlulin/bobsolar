/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1', '*.127.0.0.1'],
};

// Conditionally apply Serwist only in production to avoid Turbopack conflict in dev.
export default async function getNextConfig() {
  if (process.env.NODE_ENV !== 'production') {
    return { ...nextConfig, turbopack: {} };
  }
  const { default: withSerwistInit } = await import('@serwist/next');
  const withSerwist = withSerwistInit({
    swSrc: 'src/sw.ts',
    swDest: 'public/sw.js',
  });
  return withSerwist(nextConfig);
}
