import './globals.css'
import { Inter } from 'next/font/google'
import Link from 'next/link'

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
        <div className="min-h-screen bg-gray-50">
          {/* Navigation */}
          <nav className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <div className="flex items-center space-x-8">
                  <Link href="/" className="text-xl font-bold text-blue-600">
                    P2P Kids Admin
                  </Link>
                  <div className="hidden md:flex space-x-4">
                    <Link
                      href="/config"
                      className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Configuration
                    </Link>
                    <Link
                      href="/users"
                      className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Users
                    </Link>
                    <Link
                      href="/audit-logs"
                      className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Audit Logs
                    </Link>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Admin Portal</span>
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="py-6">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-200 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <p className="text-center text-sm text-gray-500">
                © 2024 P2P Kids Marketplace. All rights reserved.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
