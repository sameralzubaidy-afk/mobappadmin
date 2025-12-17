import './globals.css'
import { Inter } from 'next/font/google'
import { ProtectedLayout } from './components/ProtectedLayout'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'P2P Kids Marketplace - Admin Portal',
  description: 'Admin portal for P2P Kids Marketplace',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ProtectedLayout>{children}</ProtectedLayout>
      </body>
    </html>
  )
}
