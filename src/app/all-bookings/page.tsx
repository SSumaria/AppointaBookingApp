
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { DateRange } from "react-day-picker";
import { Calendar as CalendarIconLucide, ListFilter, XCircle, Edit, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import Link from 'next/link';
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
import { ref, get, query as rtQuery, orderByChild, startAt, endAt, update, push as firebasePush } from "firebase/database";
import { db } from '@/lib/firebaseConfig';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';


interface Note {
  id: string;
  text: string;
  timestamp: number;
}

interface Booking {
  id: string;
  AppointmentID: string;
  ClientID: string;
  ClientName?: string;
  ServiceProcedure: string;
  AppointmentDate: string;
  AppointmentStartTime: string;
  AppointmentEndTime: string;
  BookingStatus?: string;
  Notes?: Note[];
  BookedByUserID?: string;
}

// Helper to generate a simple unique ID for notes
const generateNoteId = () => {
  return Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
};


export default function AllBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>(undefined);
  const [clientsCache, setClientsCache] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [newNoteInputValue, setNewNoteInputValue] = useState('');

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

      if (filterDateRange?.from && filterDateRange?.to) {
        const formattedFromDate = format(filterDateRange.from, "yyyy-MM-dd");
        const formattedToDate = format(filterDateRange.to, "yyyy-MM-dd");
        bookingsQuery = rtQuery(appointmentsRef, orderByChild('AppointmentDate'), startAt(formattedFromDate), endAt(formattedToDate));
      } else if (filterDateRange?.from) {
        const formattedDate = format(filterDateRange.from, "yyyy-MM-dd");
        bookingsQuery = rtQuery(appointmentsRef, orderByChild('AppointmentDate'), startAt(formattedDate), endAt(formattedDate));
      }
      else {
        bookingsQuery = rtQuery(appointmentsRef, orderByChild('AppointmentDate'));
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

      const bookingsWithClientNames = await Promise.all(
        fetchedBookings.map(async (booking) => {
          const clientName = await fetchClientName(booking.ClientID);
          return { ...booking, ClientName: clientName };
        })
      );

      bookingsWithClientNames.sort((a, b) => {
        const dateComparison = b.AppointmentDate.localeCompare(a.AppointmentDate);
        if (dateComparison !== 0) return dateComparison;
        return b.AppointmentStartTime.localeCompare(a.AppointmentStartTime);
      });

      setBookings(bookingsWithClientNames);
      if (bookingsWithClientNames.length === 0 && filterDateRange?.from) {
         toast({
          title: "No Bookings",
          description: `No bookings found for the selected date range.`,
        });
      } else if (bookingsWithClientNames.length === 0 && !filterDateRange?.from){
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
  }, [currentUser?.uid, filterDateRange, fetchClientName, toast]);

  useEffect(() => {
    if (currentUser) {
      fetchBookings();
    }
  }, [currentUser, fetchBookings]);

  const handleFilterDateChange = (selectedRange: DateRange | undefined) => {
    setFilterDateRange(selectedRange);
  };

  const clearFilter = () => {
    setFilterDateRange(undefined);
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!currentUser?.uid) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    try {
      const bookingRefPath = `Appointments/${currentUser.uid}/${bookingId}`;
      await update(ref(db, bookingRefPath), { BookingStatus: "Cancelled" });
      toast({
        title: "Booking Cancelled",
        description: "The booking has been successfully cancelled.",
      });
      fetchBookings();
    } catch (error: any) {
      console.error("Error cancelling booking:", error);
      toast({
        title: "Error Cancelling Booking",
        description: error.message || "Could not cancel the booking.",
        variant: "destructive",
      });
    }
  };

  const handleAddNote = async () => {
    if (!currentUser?.uid || !editingBooking || !newNoteInputValue.trim()) {
      toast({ title: "Error", description: "Cannot add note. No booking selected, user not logged in, or note is empty.", variant: "destructive" });
      return;
    }
    const bookingId = editingBooking.id;
    const newNoteText = newNoteInputValue.trim();

    const newNote: Note = {
      id: generateNoteId(), // Using client-side generated ID
      text: newNoteText,
      timestamp: Date.now(),
    };

    try {
      const bookingRefPath = `Appointments/${currentUser.uid}/${bookingId}`;
      const currentNotes = editingBooking.Notes || [];
      const updatedNotes = [...currentNotes, newNote];

      await update(ref(db, bookingRefPath), { Notes: updatedNotes });
      toast({
        title: "Note Added",
        description: "The new note has been added to the booking.",
      });
      setNewNoteInputValue(''); // Clear input
      // Optimistically update local state for immediate UI feedback in dialog
      setEditingBooking(prev => prev ? {...prev, Notes: updatedNotes} : null);
      // Or refetch all bookings for consistency
      fetchBookings();
    } catch (error: any) {
      console.error("Error adding note:", error);
      toast({
        title: "Error Adding Note",
        description: error.message || "Could not add the note.",
        variant: "destructive",
      });
    }
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
      <Dialog open={!!editingBooking} onOpenChange={(isOpen) => { if (!isOpen) { setEditingBooking(null); setNewNoteInputValue('');} }}>
        <main className="flex-grow py-10">
          <div className="container max-w-6xl mx-auto">
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-bold flex items-center text-primary">
                  <ListFilter className="mr-2 h-6 w-6" /> All Bookings
                </CardTitle>
                <CardDescription>
                  View and filter all your bookings by date range. Click the <Edit className="inline h-4 w-4" /> icon to manage notes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full sm:w-[300px] justify-start text-left font-normal",
                          !filterDateRange?.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIconLucide className="mr-2 h-4 w-4" />
                        {filterDateRange?.from ? (
                          filterDateRange.to ? (
                            <>
                              {format(filterDateRange.from, "LLL dd, y")} -{" "}
                              {format(filterDateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(filterDateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Filter by date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="range"
                        selected={filterDateRange}
                        onSelect={handleFilterDateChange}
                        initialFocus
                        numberOfMonths={1}
                      />
                    </PopoverContent>
                  </Popover>
                  {filterDateRange?.from && (
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
                ) : bookings.length > 0 ? (
                  <Table>
                    <TableCaption>
                      {filterDateRange?.from
                        ? `A list of your bookings from ${format(filterDateRange.from, "PPP")}${filterDateRange.to ? ` to ${format(filterDateRange.to, "PPP")}` : ''}.`
                        : "A list of all your bookings."}
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">Client Name</TableHead>
                        <TableHead className="w-[200px]">Service/Procedure</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead className="w-[200px]">Latest Note</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">
                            {booking.ClientName && booking.ClientID ? (
                              <Link href={`/clients/${booking.ClientID}`} className="text-primary hover:underline">
                                {booking.ClientName}
                              </Link>
                            ) : (
                              booking.ClientName || 'Loading...'
                            )}
                          </TableCell>
                          <TableCell>{booking.ServiceProcedure}</TableCell>
                          <TableCell>{format(new Date(booking.AppointmentDate), "PPP")}</TableCell>
                          <TableCell>{booking.AppointmentStartTime}</TableCell>
                          <TableCell>{booking.AppointmentEndTime}</TableCell>
                          <TableCell className="text-sm text-muted-foreground ">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate max-w-[120px]" title={booking.Notes && booking.Notes.length > 0 ? booking.Notes[booking.Notes.length - 1].text : 'N/A'}>
                                {booking.Notes && booking.Notes.length > 0 ? booking.Notes[booking.Notes.length - 1].text : 'N/A'}
                              </span>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    setEditingBooking(booking);
                                    setNewNoteInputValue(''); // Clear for new note
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                            </div>
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
                          <TableCell>
                            {booking.BookingStatus === "Booked" && (
                               <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm">
                                    <XCircle className="mr-1 h-4 w-4" /> Cancel
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action will cancel the booking for {booking.ClientName} on {format(new Date(booking.AppointmentDate), "PPP")} at {booking.AppointmentStartTime}. This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleCancelBooking(booking.id)}>
                                      Confirm Cancellation
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground">
                      {filterDateRange?.from
                        ? `No bookings found for the selected date range.`
                        : "You have no bookings yet."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>

        {editingBooking && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Manage Notes for {editingBooking.ClientName}
              </DialogTitle>
              <DialogDescription>
                Appointment on {format(new Date(editingBooking.AppointmentDate), "PPP")} at {editingBooking.AppointmentStartTime} - {editingBooking.AppointmentEndTime}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {editingBooking.Notes && editingBooking.Notes.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Existing Notes:</h4>
                  <ScrollArea className="h-[150px] w-full rounded-md border p-3">
                    <ul className="space-y-2">
                      {editingBooking.Notes.slice().sort((a,b) => b.timestamp - a.timestamp).map((note) => (
                        <li key={note.id} className="text-xs p-2 bg-muted/50 rounded">
                          <p className="whitespace-pre-wrap">{note.text}</p>
                          <p className="text-muted-foreground text-right text-[10px] mt-1">
                            {format(new Date(note.timestamp), "MMM d, yyyy h:mm a")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
               {(editingBooking.Notes?.length === 0 || !editingBooking.Notes) && (
                <p className="text-sm text-muted-foreground">No existing notes for this booking.</p>
              )}

              <div className="grid grid-cols-1 items-center gap-2 mt-4">
                <Label htmlFor="new-notes-input" className="font-medium">
                  Add New Note
                </Label>
                <Textarea
                  id="new-notes-input"
                  value={newNoteInputValue}
                  onChange={(e) => setNewNoteInputValue(e.target.value)}
                  placeholder="Type your new note here..."
                  rows={3}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditingBooking(null); setNewNoteInputValue('');} }>Close</Button>
              <Button onClick={handleAddNote} disabled={!newNoteInputValue.trim()}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Note
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">
        © {new Date().getFullYear()} ServiceBooker Pro. All rights reserved.
      </footer>
    </div>
  );
}

    