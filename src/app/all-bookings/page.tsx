
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { DateRange, DayContentProps } from "react-day-picker";
import { Calendar as CalendarIconLucide, ListFilter, XCircle, Edit, PlusCircle, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, isSameDay, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { ref, get, query as rtQuery, orderByChild, update } from "firebase/database";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WeeklyCalendarView from '@/components/calendar/WeeklyCalendarView';


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
  AppointmentDate: string; // yyyy-MM-dd
  AppointmentStartTime: string;
  AppointmentEndTime: string;
  BookingStatus?: string;
  Notes?: Note[];
  BookedByUserID?: string;
}

const generateNoteId = () => {
  return Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
};


export default function AllBookingsPage() {
  const [allFetchedBookings, setAllFetchedBookings] = useState<Booking[]>([]);
  const [bookingsForDisplay, setBookingsForDisplay] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>(undefined);
  const [clientsCache, setClientsCache] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [newNoteInputValue, setNewNoteInputValue] = useState('');
  const [calendarOverviewMonth, setCalendarOverviewMonth] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<"month" | "week">("month");
  const [weekViewDate, setWeekViewDate] = useState<Date>(new Date());


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

  const fetchAndSetAllBookings = useCallback(async () => {
    if (!currentUser?.uid) return;

    setIsLoading(true);
    try {
      const userAppointmentsRefPath = `Appointments/${currentUser.uid}`;
      const appointmentsRef = ref(db, userAppointmentsRefPath);
      const bookingsQuery = rtQuery(appointmentsRef, orderByChild('AppointmentDate'));

      const snapshot = await get(bookingsQuery);
      const fetchedBookings: Booking[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          let processedNotes: Note[] = [];
            if (data.Notes) {
            if (Array.isArray(data.Notes)) {
              processedNotes = data.Notes.filter((n: any) => n && typeof n.text === 'string' && typeof n.timestamp === 'number' && typeof n.id === 'string');
            } else if (typeof data.Notes === 'object' && !Array.isArray(data.Notes)) {
              processedNotes = Object.values(data.Notes as Record<string, Note>).filter((n: any) => n && typeof n.text === 'string' && typeof n.timestamp === 'number' && typeof n.id === 'string');
            } else if (typeof data.Notes === 'string' && data.Notes.trim() !== '') {
              processedNotes = [{
                id: generateNoteId(),
                text: data.Notes,
                timestamp: data.timestamp || Date.now()
              }];
            }
          }
          fetchedBookings.push({
            id: childSnapshot.key as string,
            ...data,
            Notes: processedNotes,
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

      setAllFetchedBookings(bookingsWithClientNames);

    } catch (error: any) {
      console.error("Error fetching bookings:", error);
      // Toast removed as per user request
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.uid, fetchClientName]);

  useEffect(() => {
    if (currentUser) {
      fetchAndSetAllBookings();
    }
  }, [currentUser, fetchAndSetAllBookings]);

  useEffect(() => {
    setIsLoading(true);
    if (!filterDateRange?.from) {
      setBookingsForDisplay(allFetchedBookings);
      setIsLoading(false);
      return;
    }

    const fromDate = filterDateRange.from;
    const toDate = filterDateRange.to || filterDateRange.from;

    const filtered = allFetchedBookings.filter(booking => {
      const bookingDate = parseISO(booking.AppointmentDate);
      return bookingDate >= fromDate && bookingDate <= toDate;
    });
    // Toast removed as per user request
    setBookingsForDisplay(filtered);
    setIsLoading(false);
  }, [allFetchedBookings, filterDateRange, currentUser, authLoading]);


  const handleFilterDateChange = (selectedRange: DateRange | undefined) => {
    setFilterDateRange(selectedRange);
    if (selectedRange?.from) {
        setWeekViewDate(selectedRange.from);
    }
  };

  const handleCalendarDayClick = (day: Date | undefined) => {
    if (day) {
      const normalizedDay = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      setFilterDateRange({ from: normalizedDay, to: normalizedDay });
      setWeekViewDate(normalizedDay); 
    } else {
      setFilterDateRange(undefined);
    }
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
      fetchAndSetAllBookings();
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
      toast({ title: "Error", description: "Cannot add note.", variant: "destructive" });
      return;
    }
    const bookingId = editingBooking.id;
    const newNote: Note = { id: generateNoteId(), text: newNoteInputValue.trim(), timestamp: Date.now() };

    try {
      const bookingRefPath = `Appointments/${currentUser.uid}/${bookingId}`;
      let currentNotes: Note[] = Array.isArray(editingBooking.Notes) ? editingBooking.Notes : [];
      const updatedNotes = [...currentNotes, newNote];

      await update(ref(db, bookingRefPath), { Notes: updatedNotes });
      toast({ title: "Note Added", description: "The new note has been added." });
      setNewNoteInputValue('');

      setEditingBooking(prev => prev ? {...prev, Notes: updatedNotes} : null);
      setAllFetchedBookings(prevBookings => prevBookings.map(b =>
          b.id === bookingId ? { ...b, Notes: updatedNotes } : b
      ));
    } catch (error: any) {
      console.error("Error adding note:", error);
      toast({ title: "Error Adding Note", description: error.message, variant: "destructive" });
    }
  };


  const CustomDayContent = (props: DayContentProps) => {
    const dayBookings = allFetchedBookings
      .filter(booking => isSameDay(parseISO(booking.AppointmentDate), props.date) && booking.BookingStatus !== "Cancelled")
      .sort((a, b) => a.AppointmentStartTime.localeCompare(b.AppointmentStartTime));
    
    const isToday = isSameDay(props.date, new Date());

    return (
      <div className="flex flex-col h-full items-start w-full text-left relative z-10 p-1">
        <span className={cn(
          "font-medium text-sm block",
          props.displayMonth.getMonth() !== props.date.getMonth() && "text-muted-foreground/50",
          isToday && !props.selected && "text-primary font-bold", 
          props.selected && isToday && "text-primary font-bold" 
        )}>
          {props.date.getDate()}
        </span>
        {dayBookings.length > 0 && (
          <ScrollArea className="mt-1 text-xs leading-tight flex-grow w-full pr-0.5 max-h-[calc(theme(spacing.28)_-_theme(spacing.8))]">
            <div className="space-y-1">
              {dayBookings.slice(0, 3).map(booking => (
                <div
                  key={booking.id}
                  className="p-1 bg-primary/10 dark:bg-primary/20 rounded-sm text-xs"
                  title={`${booking.AppointmentStartTime} - ${booking.ClientName}: ${booking.ServiceProcedure}`}
                >
                  <div className="flex items-center truncate">
                    <span className="font-semibold text-primary mr-1">{booking.AppointmentStartTime}</span>
                    <span className="truncate">{booking.ClientName || "Loading..."}</span>
                  </div>
                </div>
              ))}
              {dayBookings.length > 3 && (
                <div className="text-muted-foreground text-center text-[9px] mt-0.5">+ {dayBookings.length - 3} more</div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    );
  };

  const currentWeekDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(weekViewDate, { weekStartsOn: 1 }), // Monday
      end: endOfWeek(weekViewDate, { weekStartsOn: 1 }),     // Sunday
    });
  }, [weekViewDate]);


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
          <div className="container max-w-7xl mx-auto space-y-8">
            <Card className="shadow-xl">
              <CardHeader>
                  <CardTitle className="text-2xl font-bold flex items-center text-primary">
                    <CalendarDays className="mr-2 h-6 w-6" /> Calendar Overview
                  </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="month" onValueChange={(value) => setActiveTab(value as "month" | "week")} className="w-full">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                    <CardDescription className="flex-grow mb-2 sm:mb-0 sm:mr-4">
                      {activeTab === "month" ? "View monthly bookings. Click a day to filter the table." : "View weekly bookings. Navigate weeks below."}
                    </CardDescription>
                    <TabsList>
                      <TabsTrigger value="month">Month View</TabsTrigger>
                      <TabsTrigger value="week">Week View</TabsTrigger>
                    </TabsList>
                  </div>

                  {activeTab === "week" && (
                    <div className="flex items-center justify-between mt-2 mb-4">
                      <Button variant="outline" size="sm" onClick={() => setWeekViewDate(subDays(weekViewDate, 7))}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Prev Week
                      </Button>
                       <span className="text-lg font-semibold text-muted-foreground">
                        {currentWeekDays.length > 0 ? `${format(currentWeekDays[0], 'MMM d')} - ${format(currentWeekDays[6], 'MMM d, yyyy')}` : "Loading week..."}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setWeekViewDate(new Date())}>Today</Button>
                        <Button variant="outline" size="sm" onClick={() => setWeekViewDate(addDays(weekViewDate, 7))}>
                          Next Week <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <TabsContent value="month">
                    <Calendar
                      mode="single"
                      selected={filterDateRange?.from && isSameDay(filterDateRange.from, filterDateRange.to || filterDateRange.from) ? filterDateRange.from : undefined}
                      onSelect={handleCalendarDayClick}
                      month={calendarOverviewMonth}
                      onMonthChange={setCalendarOverviewMonth}
                      className="rounded-md border w-full"
                      classNames={{
                        table: "w-full border-collapse",
                        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                        month: "space-y-4 flex-1",
                        caption: "flex justify-center pt-1 relative items-center mb-2",
                        caption_label: "text-lg font-medium",
                        nav: "space-x-1 flex items-center",
                        nav_button: cn(buttonVariants({ variant: "outline" }), "h-8 w-8 bg-transparent p-0"),
                        nav_button_previous: "absolute left-2",
                        nav_button_next: "absolute right-2",
                        head_row: "flex border-b",
                        head_cell: "flex-1 text-muted-foreground font-normal text-[0.8rem] py-2 text-center align-middle border-x first:border-l-0 last:border-r-0",
                        row: "flex w-full border-b last:border-b-0",
                        cell: cn(
                          "h-28 flex-1 p-0 align-top relative border-x first:border-l-0 last:border-r-0",
                          "[&:has([aria-selected=true]:not([disabled]))]:!bg-transparent",
                          "focus-within:relative focus-within:z-10"
                        ),
                        day: "h-full w-full p-0 align-top text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-none",
                        day_selected: cn(
                          "relative !bg-transparent text-foreground",
                          "after:content-[''] after:absolute after:inset-0 after:border-2 after:border-muted-foreground after:rounded-sm",
                          "hover:!bg-muted/20 focus:!bg-muted/20"
                        ),
                        day_today: "font-semibold", 
                        day_outside: "text-muted-foreground/40",
                        day_disabled: "text-muted-foreground/40 opacity-50 cursor-not-allowed",
                        day_hidden: "invisible",
                      }}
                      components={{ DayContent: CustomDayContent }}
                    />
                  </TabsContent>
                  <TabsContent value="week">
                    <WeeklyCalendarView 
                      bookings={allFetchedBookings} 
                      currentDate={weekViewDate} 
                      onDayClick={(date) => {
                          handleCalendarDayClick(date);
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-bold flex items-center text-primary">
                  <ListFilter className="mr-2 h-6 w-6" /> Bookings List
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
                ) : bookingsForDisplay.length > 0 ? (
                  <Table>
                    <TableCaption>
                      {filterDateRange?.from
                        ? `A list of your bookings from ${format(filterDateRange.from, "PPP")}${filterDateRange.to && !isSameDay(filterDateRange.from, filterDateRange.to) ? ` to ${format(filterDateRange.to, "PPP")}` : ''}.`
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
                      {bookingsForDisplay.map((booking) => (
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
                          <TableCell>{format(parseISO(booking.AppointmentDate), "PPP")}</TableCell>
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
                                    setNewNoteInputValue('');
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
                                      This action will cancel the booking for {booking.ClientName} on {format(parseISO(booking.AppointmentDate), "PPP")} at {booking.AppointmentStartTime}. This cannot be undone.
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
                        : isLoading ? "Loading bookings..." : "You have no bookings yet."}
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
                Appointment on {format(parseISO(editingBooking.AppointmentDate), "PPP")} at {editingBooking.AppointmentStartTime} - {editingBooking.AppointmentEndTime}
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
