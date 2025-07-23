
import type {Metadata} from 'next';
import './globals.css';
import {Toaster} from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthContext'; // Added
import { GeistSans } from 'geist/font/sans';

export const metadata: Metadata = {
  title: 'Appointa', // Updated title
  description: 'Manage your appointments efficiently.', // Updated description
  icons: {
    icon: '/appointa_logo3.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className={`font-sans antialiased`}>
        <AuthProvider> {/* Added AuthProvider */}
          {children}
          <Toaster/>
        </AuthProvider> {/* Added AuthProvider */}
      </body>
    </html>
  );
}
