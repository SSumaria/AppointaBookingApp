
"use client";

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import PublicBookingClientPage from './PublicBookingClientPage';

// Helper component for the suspense fallback
const PublicBookingLoading = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 p-4">
        <Loader2 className="animate-spin mx-auto h-12 w-12 text-primary" />
        <p className="mt-4 text-muted-foreground">
          Loading booking page...
        </p>
        <footer className="fixed bottom-0 bg-transparent py-4 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} Appointa.</footer>
    </div>
);


export default function PublicBookingPage() {
  return (
    <Suspense fallback={<PublicBookingLoading />}>
      <PublicBookingClientPage />
    </Suspense>
  );
}
