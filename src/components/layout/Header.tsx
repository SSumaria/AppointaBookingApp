
"use client";

import Link from 'next/link';
import { Home, Calendar as CalendarIcon, Search as SearchIcon, ListChecks, LogIn, LogOut, UserPlus, UserCircle, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { useState } from 'react';

export default function Header() {
  const { currentUser, logout, loading } = useAuth();
  const router = useRouter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setIsSheetOpen(false);
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsSheetOpen(false);
  };

  const commonNavLinks = (
    <>
      <Button variant="ghost" className="justify-start w-full" onClick={() => handleNavigation('/')}>
        <Home className="mr-2 h-4 w-4" />
        Home
      </Button>
      <Button variant="ghost" className="justify-start w-full" onClick={() => handleNavigation('/new-booking')}>
        <CalendarIcon className="mr-2 h-4 w-4" />
        New Booking
      </Button>
      <Button variant="ghost" className="justify-start w-full" onClick={() => handleNavigation('/all-bookings')}>
        <ListChecks className="mr-2 h-4 w-4" />
        All Bookings
      </Button>
      <Button variant="ghost" className="justify-start w-full" onClick={() => handleNavigation('/client-search')}>
        <SearchIcon className="mr-2 h-4 w-4" />
        Client Search
      </Button>
    </>
  );

  const authButtonsSheet = (
    <>
      {currentUser ? (
        <>
          {currentUser.email && (
            <div className="px-4 py-2 text-sm text-muted-foreground border-b">
              <UserCircle className="mr-2 h-4 w-4 inline"/>
              {currentUser.email}
            </div>
          )}
          <Button variant="ghost" onClick={handleLogout} className="justify-start w-full text-destructive hover:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </>
      ) : (
        <>
          <Button variant="ghost" className="justify-start w-full" onClick={() => handleNavigation('/login')}>
            <LogIn className="mr-2 h-4 w-4" />
            Login
          </Button>
          <Button variant="default" className="justify-start w-full mt-2 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => handleNavigation('/register')}>
            <UserPlus className="mr-2 h-4 w-4" />
            Register
          </Button>
        </>
      )}
    </>
  );


  return (
    <header className="bg-background py-3 shadow-sm sticky top-0 z-50">
      <div className="container max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-xl sm:text-2xl font-bold text-primary">
          ServiceBooker Pro
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-2 sm:space-x-4">
          {currentUser && commonNavLinks}
          {loading ? (
            <div className="h-8 w-20 bg-muted rounded animate-pulse"></div>
          ) : currentUser ? (
            <>
              <span className="text-xs sm:text-sm text-muted-foreground hidden lg:inline">
                <UserCircle className="mr-1 h-4 w-4 inline"/>
                {currentUser.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs sm:text-sm">
                <LogOut className="mr-1 h-4 w-4" />
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => router.push('/login')} className="text-xs sm:text-sm">
                <LogIn className="mr-1 h-4 w-4" />
                Login
              </Button>
              <Button variant="default" size="sm" onClick={() => router.push('/register')} className="text-xs sm:text-sm bg-accent text-accent-foreground hover:bg-accent/90">
                <UserPlus className="mr-1 h-4 w-4" />
                Register
              </Button>
            </>
          )}
        </nav>

        {/* Mobile Navigation Trigger */}
        <div className="md:hidden">
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-4 flex flex-col">
              <div className="mb-4 border-b pb-2">
                <Link href="/" onClick={() => setIsSheetOpen(false)} className="text-lg font-bold text-primary">
                  ServiceBooker Pro
                </Link>
              </div>
              <nav className="flex flex-col space-y-2 flex-grow">
                {currentUser && commonNavLinks}
              </nav>
              <div className="mt-auto pt-4 border-t">
                {loading ? (
                    <div className="space-y-2">
                        <div className="h-8 w-full bg-muted rounded animate-pulse"></div>
                        <div className="h-8 w-full bg-muted rounded animate-pulse"></div>
                    </div>
                ) : authButtonsSheet }
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
