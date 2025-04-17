"use client";

import Link from 'next/link';
import { Home, Calendar, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-background py-4 shadow-sm">
        <div className="container max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            ServiceBooker Pro
          </Link>
          <nav className="flex items-center space-x-6">
            <Link href="/" className="hover:text-primary flex items-center">
              <Home className="mr-1 h-5 w-5" />
              Home
            </Link>
            <Link href="/new-booking" className="hover:text-primary flex items-center">
              <Calendar className="mr-1 h-5 w-5" />
              New Booking
            </Link>
            <Link href="/client-search" className="hover:text-primary flex items-center">
              <Search className="mr-1 h-5 w-5" />
              Client Search
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-12">
        <div className="container max-w-5xl mx-auto text-center">
          <h1 className="text-4xl font-extrabold text-primary mb-4">
            Welcome to ServiceBooker Pro
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            The easiest way to manage appointments and keep track of your clients
          </p>
          <Link href="/new-booking">
            <Button className="bg-accent text-primary-foreground hover:bg-accent/80 font-bold py-3 px-6 rounded-md">
              Create New Booking →
            </Button>
          </Link>
        </div>

        {/* Features Section */}
        <div className="container max-w-5xl mx-auto mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 bg-card rounded-md shadow-sm">
            <Calendar className="h-8 w-8 text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Easy Scheduling</h2>
            <p className="text-sm text-muted-foreground">
              Quickly book appointments with an intuitive scheduling interface.
            </p>
          </div>
          <div className="p-6 bg-card rounded-md shadow-sm">
            <Clock className="h-8 w-8 text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Time Management</h2>
            <p className="text-sm text-muted-foreground">
              Organize your day efficiently with our booking system.
            </p>
          </div>
          <div className="p-6 bg-card rounded-md shadow-sm">
            <Users className="h-8 w-8 text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Client Database</h2>
            <p className="text-sm text-muted-foreground">
              Keep track of all your clients and their appointment history.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-background py-4 text-center text-sm text-muted-foreground">
        © 2025 ServiceBooker Pro. All rights reserved.
      </footer>
    </div>
  );
}

function Clock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function Users(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="18" x2="23" y1="8" y2="13" />
      <line x1="23" x2="18" y1="8" y2="13" />
    </svg>
  );
}

