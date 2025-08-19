
import { Suspense } from 'react';
import AllBookingsClientPage from './AllBookingsClientPage';
import { Loader2 } from 'lucide-react';
import Header from '@/components/layout/Header';

// Helper component for the suspense fallback
const AllBookingsLoading = () => (
    <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="animate-spin mx-auto h-12 w-12 text-primary" />
            <p className="mt-4 text-muted-foreground">
              Loading bookings...
            </p>
          </div>
        </main>
        <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">© {new Date().getFullYear()} Appointa.</footer>
    </div>
);


export default function AllBookingsPage() {
  return (
    <Suspense fallback={<AllBookingsLoading />}>
      <AllBookingsClientPage />
    </Suspense>
  );
}
