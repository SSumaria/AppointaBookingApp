
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { User, Calendar as CalendarIconLucide, Briefcase, Mail, Phone, Clock, StickyNote } from "lucide-react"; // Added StickyNote
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import { ref, get, query as rtQuery, orderByChild, equalTo } from "firebase/database";
import { db } from '@/lib/firebaseConfig';

interface Client {
  id: string;
  ClientID: string;
  ClientName: string;
  ClientContact?: string;
  CreateDate: string;
  CreateTime: string;
  CreatedByUserID?: string;
}

interface Booking {
  id: string;
  ClientID: string;
  ServiceProcedure: string;
  AppointmentDate: string;
  AppointmentStartTime: string;
  AppointmentEndTime: string;
  BookingStatus?: string;
  Notes?: string; // Added Notes
  BookedByUserID?: string;
}

export default function ClientDetailsPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const router = useRouter();
  const { currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [client, setClient] = useState<Client | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoadingClient, setIsLoadingClient] = useState(true);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);

  const fetchClientDetails = useCallback(async () => {
    if (!currentUser?.uid || !clientId) return;
    setIsLoadingClient(true);
    try {
      const clientRef = ref(db, `Clients/${currentUser.uid}/${clientId}`);
      const snapshot = await get(clientRef);
      if (snapshot.exists()) {
        setClient({ id: snapshot.key, ...snapshot.val() } as Client);
      } else {
        toast({
          title: "Client Not Found",
          description: "The requested client could not be found under your account.",
          variant: "destructive",
        });
        setClient(null);
      }
    } catch (error: any) {
      console.error("Error fetching client details:", error);
      toast({
        title: "Error Fetching Client",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingClient(false);
    }
  }, [currentUser?.uid, clientId, toast]);

  const fetchClientBookings = useCallback(async () => {
    if (!currentUser?.uid || !clientId) return;
    setIsLoadingBookings(true);
    try {
      const userAppointmentsRefPath = `Appointments/${currentUser.uid}`;
      const appointmentsRef = ref(db, userAppointmentsRefPath);
      const bookingsQuery = rtQuery(appointmentsRef, orderByChild('ClientID'), equalTo(clientId));

      const snapshot = await get(bookingsQuery);
      const fetchedBookings: Booking[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          fetchedBookings.push({
            id: childSnapshot.key as string,
            ...childSnapshot.val(),
          });
        });
      }
      fetchedBookings.sort((a, b) => {
        const dateComparison = b.AppointmentDate.localeCompare(a.AppointmentDate);
        if (dateComparison !== 0) return dateComparison;
        return b.AppointmentStartTime.localeCompare(a.AppointmentStartTime);
      });
      setBookings(fetchedBookings);
    } catch (error: any) {
      console.error("Error fetching client bookings:", error);
      toast({
        title: "Error Fetching Bookings",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingBookings(false);
    }
  }, [currentUser?.uid, clientId, toast]);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    } else if (currentUser && clientId) {
      fetchClientDetails();
      fetchClientBookings();
    }
  }, [currentUser, authLoading, clientId, router, fetchClientDetails, fetchClientBookings]);


  if (authLoading || (!client && isLoadingClient)) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <svg className="animate-spin mx-auto h-12 w-12 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-muted-foreground">Loading client details...</p>
          </div>
        </main>
        <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">
          © {new Date().getFullYear()} ServiceBooker Pro. All rights reserved.
        </footer>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <Card className="w-full max-w-md p-8 shadow-lg">
                <CardTitle className="text-2xl text-destructive mb-4">Client Not Found</CardTitle>
                <CardDescription className="mb-6">
                    The client you are looking for does not exist or you do not have permission to view them.
                </CardDescription>
                <Button onClick={() => router.push('/client-search')}>Back to Client Search</Button>
            </Card>
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
        <div className="container max-w-5xl mx-auto space-y-8">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-3xl font-bold flex items-center text-primary">
                <User className="mr-3 h-8 w-8" /> {client.ClientName}
              </CardTitle>
              <CardDescription>
                Detailed information and booking history for {client.ClientName}.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-muted-foreground">Client Information</h3>
                {client.ClientContact && (
                  <p className="flex items-center">
                    {client.ClientContact.includes('@') ? <Mail className="mr-2 h-5 w-5 text-primary/80" /> : <Phone className="mr-2 h-5 w-5 text-primary/80" />}
                    <span className="font-medium">Contact:</span> {client.ClientContact}
                  </p>
                )}
                <p className="flex items-center"><CalendarIconLucide className="mr-2 h-5 w-5 text-primary/80" /> <span className="font-medium">Date Created:</span> {format(new Date(client.CreateDate), "PPP")}</p>
                <p className="flex items-center"><Clock className="mr-2 h-5 w-5 text-primary/80" /> <span className="font-medium">Time Created:</span> {client.CreateTime}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold flex items-center text-primary">
                <Briefcase className="mr-2 h-6 w-6" /> Booking History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingBookings ? (
                 <div className="text-center py-10">
                    <svg className="animate-spin mx-auto h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-2 text-muted-foreground">Loading bookings...</p>
                </div>
              ) : bookings.length > 0 ? (
                <Table>
                  <TableCaption>A list of all bookings for {client.ClientName}.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Service/Procedure</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead className="w-[200px]">Notes</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.ServiceProcedure}</TableCell>
                        <TableCell>{format(new Date(booking.AppointmentDate), "PPP")}</TableCell>
                        <TableCell>{booking.AppointmentStartTime}</TableCell>
                        <TableCell>{booking.AppointmentEndTime}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={booking.Notes}>
                            {booking.Notes || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "px-2 py-1 rounded-full text-xs font-medium",
                            booking.BookingStatus === "Booked" && "bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-200",
                            booking.BookingStatus === "Cancelled" && "bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-200",
                            (!booking.BookingStatus || (booking.BookingStatus !== "Booked" && booking.BookingStatus !== "Cancelled")) && "bg-muted text-muted-foreground"
                          )}>
                            {booking.BookingStatus ? booking.BookingStatus : "Unknown"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">{client.ClientName} has no bookings yet.</p>
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
