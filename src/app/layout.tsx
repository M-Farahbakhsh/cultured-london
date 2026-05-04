import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cultured London — Events for you',
  description: 'Discover London events matched to your taste in music, books, film, and ideas.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
