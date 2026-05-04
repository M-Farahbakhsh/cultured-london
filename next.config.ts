import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.evbuc.com' },
      { protocol: 'https', hostname: 'secure.meetupstatic.com' },
      { protocol: 'https', hostname: 'images.dice.fm' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

export default nextConfig
