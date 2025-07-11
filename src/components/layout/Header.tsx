
"use client";

import Link from 'next/link';
import { LayoutDashboard, Calendar as CalendarIcon, Search as SearchIcon, ListChecks, LogIn, LogOut, UserPlus, UserCircle, Menu, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Header() {
  const { currentUser, logout, loading } = useAuth();
  const router = useRouter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setIsSheetOpen(false); // Close sheet if open
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsSheetOpen(false);
  };

  const commonNavLinks = (
    <>
      <Button variant="ghost" className="justify-start w-full md:w-auto md:justify-center" onClick={() => handleNavigation('/dashboard')}>
        <LayoutDashboard className="mr-2 h-4 w-4" />
        Dashboard
      </Button>
      <Button variant="ghost" className="justify-start w-full md:w-auto md:justify-center" onClick={() => handleNavigation('/new-booking')}>
        <CalendarIcon className="mr-2 h-4 w-4" />
        New Booking
      </Button>
      <Button variant="ghost" className="justify-start w-full md:w-auto md:justify-center" onClick={() => handleNavigation('/all-bookings')}>
        <ListChecks className="mr-2 h-4 w-4" />
        All Bookings
      </Button>
      <Button variant="ghost" className="justify-start w-full md:w-auto md:justify-center" onClick={() => handleNavigation('/client-search')}>
        <SearchIcon className="mr-2 h-4 w-4" />
        Client Search
      </Button>
    </>
  );

  const authButtonsSheet = (
    <>
      {currentUser ? (
        <>
          {currentUser.displayName && (
            <div className="px-4 py-2 text-sm text-muted-foreground border-b">
              <UserCircle className="mr-2 h-4 w-4 inline"/>
              {currentUser.displayName}
            </div>
          )}
          <Button variant="ghost" className="justify-start w-full" onClick={() => handleNavigation('/preferences')}>
            <Settings className="mr-2 h-4 w-4" />
            Manage Preferences
          </Button>
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
      <div className="container max-w-5xl mx-auto flex items-center justify-between px-4">
        <Link href={currentUser ? '/dashboard' : '/'} onClick={() => setIsSheetOpen(false)} className="flex items-center">
           <h1 className="text-2xl font-extrabold text-primary">Appointa</h1>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1 sm:space-x-2">
          {currentUser && commonNavLinks}
          {loading ? (
            <div className="h-8 w-28 bg-muted rounded animate-pulse ml-2"></div>
          ) : currentUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs sm:text-sm ml-2">
                  <UserCircle className="mr-1 h-4 w-4"/>
                  {currentUser.displayName || currentUser.email}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => router.push('/preferences')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Manage Preferences</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            <SheetContent side="right" className="w-[280px] p-0 flex flex-col">
              <div className="p-4 mb-2 border-b">
                <Link href={currentUser ? '/dashboard' : '/'} onClick={() => setIsSheetOpen(false)} className="flex items-center">
                   <h1 className="text-2xl font-extrabold text-primary">Appointa</h1>
                </Link>
              </div>
              <nav className="flex flex-col space-y-1 px-2 flex-grow">
                {currentUser && commonNavLinks}
              </nav>
              <div className="mt-auto p-2 border-t">
                {loading ? (
                    <div className="space-y-2 px-2">
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
