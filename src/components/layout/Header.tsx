
"use client";

import Link from 'next/link';
import { Home, Calendar as CalendarIcon, Search as SearchIcon, LogIn, LogOut, UserPlus, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Header() {
  const { currentUser, logout, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    // router.push('/login'); // Already handled in AuthContext logout
  };

  return (
    <header className="bg-background py-4 shadow-sm sticky top-0 z-50">
      <div className="container max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold text-primary">
          ServiceBooker Pro
        </Link>
        <nav className="flex items-center space-x-4">
          {currentUser && (
            <>
              <Link href="/" className="hover:text-primary flex items-center text-sm">
                <Home className="mr-1 h-4 w-4" />
                Home
              </Link>
              <Link href="/new-booking" className="hover:text-primary flex items-center text-sm">
                <CalendarIcon className="mr-1 h-4 w-4" />
                New Booking
              </Link>
              <Link href="/client-search" className="hover:text-primary flex items-center text-sm">
                <SearchIcon className="mr-1 h-4 w-4" />
                Client Search
              </Link>
            </>
          )}
          
          {loading ? (
            <div className="h-8 w-20 bg-muted rounded animate-pulse"></div>
          ) : currentUser ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                <UserCircle className="mr-1 h-4 w-4 inline"/>
                {currentUser.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-sm">
                <LogOut className="mr-1 h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => router.push('/login')} className="text-sm">
                <LogIn className="mr-1 h-4 w-4" />
                Login
              </Button>
              <Button variant="default" size="sm" onClick={() => router.push('/register')} className="text-sm bg-accent text-accent-foreground hover:bg-accent/90">
                <UserPlus className="mr-1 h-4 w-4" />
                Register
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
