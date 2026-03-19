import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tunda — Business Management',
  description: 'Stock, POS, credit tracking and accounting for small businesses in Uganda',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-50 text-slate-900 antialiased">{children}</body>
    </html>
  )
}
