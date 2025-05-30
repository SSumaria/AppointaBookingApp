
"use client";

import Link from 'next/link';
import { Home, Calendar as CalendarIcon, Search as SearchIcon, ListChecks, LogIn, LogOut, UserPlus, UserCircle } from "lucide-react"; // Added ListChecks
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
        <nav className="flex items-center space-x-2 sm:space-x-4">
          {currentUser && (
            <>
              <Link href="/" className="hover:text-primary flex items-center text-xs sm:text-sm p-1 sm:p-0">
                <Home className="mr-1 h-4 w-4" />
                Home
              </Link>
              <Link href="/new-booking" className="hover:text-primary flex items-center text-xs sm:text-sm p-1 sm:p-0">
                <CalendarIcon className="mr-1 h-4 w-4" />
                New Booking
              </Link>
              <Link href="/all-bookings" className="hover:text-primary flex items-center text-xs sm:text-sm p-1 sm:p-0"> {/* Added this link */}
                <ListChecks className="mr-1 h-4 w-4" />
                All Bookings
              </Link>
              <Link href="/client-search" className="hover:text-primary flex items-center text-xs sm:text-sm p-1 sm:p-0">
                <SearchIcon className="mr-1 h-4 w-4" />
                Client Search
              </Link>
            </>
          )}
          
          {loading ? (
            <div className="h-8 w-16 sm:w-20 bg-muted rounded animate-pulse"></div>
          ) : currentUser ? (
            <>
              <span className="text-xs sm:text-sm text-muted-foreground hidden md:inline">
                <UserCircle className="mr-1 h-4 w-4 inline"/>
                {currentUser.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs sm:text-sm p-1 sm:px-2 sm:py-1">
                <LogOut className="mr-1 h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => router.push('/login')} className="text-xs sm:text-sm p-1 sm:px-2 sm:py-1">
                <LogIn className="mr-1 h-4 w-4" />
                Login
              </Button>
              <Button variant="default" size="sm" onClick={() => router.push('/register')} className="text-xs sm:text-sm bg-accent text-accent-foreground hover:bg-accent/90 p-1 sm:px-2 sm:py-1">
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

