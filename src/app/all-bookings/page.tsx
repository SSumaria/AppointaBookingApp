
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIconLucide, ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ref, get, query as rtQuery, orderByChild, equalTo } from "firebase/database";
import { db } from '@/lib/firebaseConfig';

interface Booking {
  id: string; // Firebase key of the appointment
  AppointmentID: string;
  ClientID: string;
  ClientName?: string; // Will be fetched
  ServiceProcedure: string;
  AppointmentDate: string;
  AppointmentTime: string;
  BookedByUserID?: string;
}

export default function AllBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [clientsCache, setClientsCache] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  const fetchClientName = useCallback(async (clientId: string): Promise<string> => {
    if (!currentUser?.uid) return "Unknown Client";
    if (clientsCache[clientId]) {
      return clientsCache[clientId];
    }
    try {
      const clientRef = ref(db, `Clients/${currentUser.uid}/${clientId}/ClientName`);
      const snapshot = await get(clientRef);
      if (snapshot.exists()) {
        const clientName = snapshot.val();
        setClientsCache(prev => ({ ...prev, [clientId]: clientName }));
        return clientName;
      }
      return "Client Not Found";
    } catch (error) {
      console.error("Error fetching client name:", error);
      return "Error Fetching Name";
    }
  }, [currentUser?.uid, clientsCache]);

  const fetchBookings = useCallback(async () => {
    if (!currentUser?.uid) return;

    setIsLoading(true);
    try {
      const userAppointmentsRefPath = `Appointments/${currentUser.uid}`;
      const appointmentsRef = ref(db, userAppointmentsRefPath);
      let bookingsQuery;

      if (filterDate) {
        const formattedDate = format(filterDate, "yyyy-MM-dd");
        bookingsQuery = rtQuery(appointmentsRef, orderByChild('AppointmentDate'), equalTo(formattedDate));
      } else {
        bookingsQuery = rtQuery(appointmentsRef, orderByChild('AppointmentDate')); // Fetch all, ordered by date
      }

      const snapshot = await get(bookingsQuery);
      const fetchedBookings: Booking[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          fetchedBookings.push({
            id: childSnapshot.key as string,
            ...data,
          });
        });
      }
      
      // Fetch client names for each booking
      const bookingsWithClientNames = await Promise.all(
        fetchedBookings.map(async (booking) => {
          const clientName = await fetchClientName(booking.ClientID);
          return { ...booking, ClientName: clientName };
        })
      );
      
      // Sort bookings by date and then time (descending for recent first, or ascending)
      bookingsWithClientNames.sort((a, b) => {
        const dateComparison = b.AppointmentDate.localeCompare(a.AppointmentDate);
        if (dateComparison !== 0) return dateComparison;
        return b.AppointmentTime.localeCompare(a.AppointmentTime);
      });


      setBookings(bookingsWithClientNames);
      setFilteredBookings(bookingsWithClientNames); // Initially, all fetched bookings are shown
      if (bookingsWithClientNames.length === 0 && filterDate) {
         toast({
          title: "No Bookings",
          description: `No bookings found for ${format(filterDate, "PPP")}.`,
        });
      } else if (bookingsWithClientNames.length === 0 && !filterDate){
         toast({
          title: "No Bookings",
          description: "You have no bookings yet.",
        });
      }

    } catch (error: any) {
      console.error("Error fetching bookings:", error);
      toast({
        title: "Error Fetching Bookings",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.uid, filterDate, fetchClientName, toast]);

  useEffect(() => {
    if (currentUser) {
      fetchBookings();
    }
  }, [currentUser, fetchBookings]); // Removed filterDate from here to avoid double fetch on initial load with filterDate

  const handleFilterDateChange = (selectedDate: Date | undefined) => {
    setFilterDate(selectedDate);
    // Fetching will be triggered by the main useEffect watching `currentUser` and `fetchBookings` (which depends on `filterDate`)
  };
  
  const clearFilter = () => {
    setFilterDate(undefined);
     // Fetching will be triggered by the main useEffect watching `currentUser` and `fetchBookings` (which depends on `filterDate`)
  };


  if (authLoading || !currentUser) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <svg className="animate-spin mx-auto h-12 w-12 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-muted-foreground">Loading bookings...</p>
          </div>
        </main>
        <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">
          © {new Date().getFullYear()} ServiceBooker Pro. All rights reserved.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow py-10">
        <div className="container max-w-5xl mx-auto">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold flex items-center text-primary">
                <ListFilter className="mr-2 h-6 w-6" /> All Bookings
              </CardTitle>
              <CardDescription>
                View and filter all your bookings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full sm:w-[280px] justify-start text-left font-normal",
                        !filterDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIconLucide className="mr-2 h-4 w-4" />
                      {filterDate ? format(filterDate, "PPP") : <span>Filter by date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filterDate}
                      onSelect={(date) => handleFilterDateChange(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {filterDate && (
                  <Button variant="ghost" onClick={clearFilter}>Clear Filter</Button>
                )}
              </div>

              {isLoading ? (
                <div className="text-center py-10">
                  <svg className="animate-spin mx-auto h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="mt-2 text-muted-foreground">Loading bookings...</p>
                </div>
              ) : filteredBookings.length > 0 ? (
                <Table>
                  <TableCaption>
                    {filterDate 
                      ? `A list of your bookings for ${format(filterDate, "PPP")}.`
                      : "A list of all your bookings."}
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Client Name</TableHead>
                      <TableHead>Service/Procedure</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.ClientName || 'Loading...'}</TableCell>
                        <TableCell>{booking.ServiceProcedure}</TableCell>
                        <TableCell>{booking.AppointmentDate}</TableCell>
                        <TableCell>{booking.AppointmentTime}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">
                    {filterDate
                      ? `No bookings found for ${format(filterDate, "PPP")}.`
                      : "You have no bookings yet."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">
        © {new Date().getFullYear()} ServiceBooker Pro. All rights reserved.
      </footer>
    </div>
  );
}

