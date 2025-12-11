import './globals.css'
// Initialize client-side Sentry SDK via a small client component
import SentryClientInit from './SentryClientInit';
import AnalyticsClientInit from './AnalyticsClientInit';
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'P2P Kids Marketplace - Admin',
  description: 'Admin panel for P2P Kids Marketplace'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SentryClientInit />
        <AnalyticsClientInit />
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
