import type { Metadata } from 'next';
import './globals.css';
import { AdminShell } from '@/components/layout/AdminShell';

export const metadata: Metadata = {
  title:       'Kids Marketplace Admin',
  description: 'Admin panel for Kids P2P Marketplace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
