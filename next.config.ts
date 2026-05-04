import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.evbuc.com' },
      { protocol: 'https', hostname: 'secure.meetupstatic.com' },
      { protocol: 'https', hostname: 'images.dice.fm' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 's1.ticketm.net' },
      { protocol: 'https', hostname: '*.ticketm.net' },
      { protocol: 'https', hostname: '*.cloudfront.net' },
      { protocol: 'https', hostname: 'images.lumacdn.com' },
    ],
  },
}

export default nextConfig
