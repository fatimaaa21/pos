import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kivi',
    short_name: 'Kivi',
    description: 'Punto de venta Kivi',
    start_url: '/',
    display: 'standalone',
    theme_color: '#628321',
    icons: [
      {
        src: '/icons/Isotipo-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/Isotipo-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}