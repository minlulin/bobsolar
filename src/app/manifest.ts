import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BOB Solar',
    short_name: 'BOB Solar',
    description: 'Solar Installation Management System',
    start_url: '/',
    display: 'standalone',
    background_color: '#121212',
    theme_color: '#F59E0B',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
