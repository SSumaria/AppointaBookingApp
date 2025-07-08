
import type {Metadata} from 'next';
import './globals.css';
import {Toaster} from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthContext'; // Added

export const metadata: Metadata = {
  title: 'Appointa', // Updated title
  description: 'Manage your appointments efficiently.', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}> {/* Removed Geist font classes */}
        <AuthProvider> {/* Added AuthProvider */}
          {children}
          <Toaster/>
        </AuthProvider> {/* Added AuthProvider */}
      </body>
    </html>
  );
}
