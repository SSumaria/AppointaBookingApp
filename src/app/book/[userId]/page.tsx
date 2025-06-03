
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Calendar as CalendarIconLucideShadcn } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, addMinutes, parse } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { ref, set, get, query as rtQuery, orderByChild, equalTo, push } from "firebase/database";
import { db } from '@/lib/firebaseConfig'; // Ensure db is exported from firebaseConfig

interface ExistingBooking {
  AppointmentStartTime: string;
  AppointmentEndTime: string;
  AppointmentDate: string;
  BookingStatus?: string;
}

const generateTimeSlots = () => {
  const slots = [];
  let currentTime = new Date();
  currentTime.setHours(6, 0, 0, 0); // Start at 6:00 AM

  const endTimeLimit = new Date();
  endTimeLimit.setHours(21, 0, 0, 0); // Slots up to 21:00 (9 PM)

  while (currentTime <= endTimeLimit) {
    slots.push(format(currentTime, "HH:mm"));
    currentTime = addMinutes(currentTime, 30);
  }
  return slots;
};
const timeSlots = generateTimeSlots();

export default function PublicBookingPage() {
  const params = useParams();
  const serviceProviderUserId = params.userId as string;
  const router = useRouter();

  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [serviceProcedure, setServiceProcedure] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceProviderExists, setServiceProviderExists] = useState<boolean | null>(null);

  const [bookedTimeSlotsForDate, setBookedTimeSlotsForDate] = useState<Set<string>>(new Set());
  const [isLoadingBookedSlots, setIsLoadingBookedSlots] = useState(false);

  useEffect(() => {
    const checkServiceProvider = async () => {
      if (!serviceProviderUserId) {
        setServiceProviderExists(false);
        return;
      }
      // Check if the provider exists by trying to read a non-sensitive part of their data
      // For example, check if their top-level user node in Appointments exists
      // This is a simplified check. In production, you might have a 'users' collection.
      try {
        const providerAppointmentsRef = ref(db, `Appointments/${serviceProviderUserId}`);
        // Try a shallow read or check for a specific known key if possible to minimize data transfer
        // For this example, just checking existence by trying to get a snapshot.
        // A more robust check would be to query a `users` collection for the provider's ID.
        // For now, we assume if they have an "Appointments" node, they are a valid provider.
        // This is a placeholder check. A real app might have a /Users/{userId}/publicProfile node.
        const snapshot = await get(ref(db, `Clients/${serviceProviderUserId}`)); // Check against Clients node as a proxy
        setServiceProviderExists(snapshot.exists()); // if provider has any client records, assume they exist.
                                                    // A more direct check on a user profile node would be better.
         if (!snapshot.exists()) {
            // Try appointments as a fallback check
            const apptSnapshot = await get(ref(db, `Appointments/${serviceProviderUserId}`));
            setServiceProviderExists(apptSnapshot.exists());
        }


      } catch (error) {
        console.error("Error checking service provider:", error);
        setServiceProviderExists(false);
      }
    };
    checkServiceProvider();
  }, [serviceProviderUserId]);


  const fetchBookedSlots = useCallback(async (selectedDate: Date) => {
    if (!serviceProviderUserId || !selectedDate || !serviceProviderExists) {
      setBookedTimeSlotsForDate(new Set());
      return;
    }
    setIsLoadingBookedSlots(true);
    const formattedDate = format(selectedDate, "yyyy-MM-dd");
    const appointmentsRefPath = `Appointments/${serviceProviderUserId}`;
    const appointmentsRef = ref(db, appointmentsRefPath);
    const appointmentsQuery = rtQuery(appointmentsRef, orderByChild('AppointmentDate'), equalTo(formattedDate));

    try {
      const snapshot = await get(appointmentsQuery);
      const newBookedSlots = new Set<string>();
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const booking = childSnapshot.val() as ExistingBooking;
          if (booking.BookingStatus === "Booked") {
             try {
                const baseDateForParse = new Date(formattedDate + "T00:00:00");
                const slotStartTime = parse(booking.AppointmentStartTime, "HH:mm", baseDateForParse);
                const slotEndTime = parse(booking.AppointmentEndTime, "HH:mm", baseDateForParse);

                let currentSlotTime = slotStartTime;
                while (currentSlotTime < slotEndTime) {
                  newBookedSlots.add(format(currentSlotTime, "HH:mm"));
                  currentSlotTime = addMinutes(currentSlotTime, 30);
                }
              } catch (parseError) {
                console.error("Error parsing booking times from DB:", booking, parseError);
              }
          }
        });
      }
      setBookedTimeSlotsForDate(newBookedSlots);
    } catch (error) {
      console.error("Error fetching booked slots:", error);
      toast({
        title: "Error loading schedule",
        description: "Could not fetch existing bookings for this provider and date.",
        variant: "destructive",
      });
      setBookedTimeSlotsForDate(new Set());
    } finally {
      setIsLoadingBookedSlots(false);
    }
  }, [serviceProviderUserId, toast, serviceProviderExists]);

  useEffect(() => {
    if (date && serviceProviderUserId && serviceProviderExists) {
      fetchBookedSlots(date);
    } else {
      setBookedTimeSlotsForDate(new Set());
    }
  }, [date, serviceProviderUserId, fetchBookedSlots, serviceProviderExists]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!serviceProviderUserId) {
        toast({ title: "Error", description: "Service provider ID is missing.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }
    if (!serviceProviderExists){
        toast({ title: "Error", description: "Service provider not found.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    if (!clientName || !serviceProcedure || !date || !startTime || !endTime) {
        toast({ title: "Error", description: "Please fill in all required fields.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    const selectedFormattedDate = format(date, "yyyy-MM-dd");
    const baseDateForSubmitParse = new Date(selectedFormattedDate + "T00:00:00");
    const startDateTime = parse(startTime, 'HH:mm', baseDateForSubmitParse);
    const endDateTime = parse(endTime, 'HH:mm', baseDateForSubmitParse);

    if (endDateTime <= startDateTime) {
      toast({ title: "Validation Error", description: "End time must be after start time.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    let tempSlot = startDateTime;
    let hasOverlap = false;
    while(tempSlot < endDateTime) {
        if(bookedTimeSlotsForDate.has(format(tempSlot, "HH:mm"))) {
            hasOverlap = true;
            break;
        }
        tempSlot = addMinutes(tempSlot, 30);
    }

    if(hasOverlap) {
        toast({ title: "Booking Conflict", description: "The selected time range is no longer available or overlaps with an existing booking.", variant: "destructive" });
        setIsSubmitting(false);
        // Re-fetch slots in case availability changed
        if (date) fetchBookedSlots(date);
        return;
    }


    if (!db) {
        toast({ title: "Error", description: "Database not initialized.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    try {
        const providerClientsRefPath = `Clients/${serviceProviderUserId}`;
        const clientsDbRef = ref(db, providerClientsRefPath);
        const newClientRef = push(clientsDbRef);
        const newClientId = newClientRef.key as string;
        const now = new Date();

        await set(newClientRef, {
            ClientID: newClientId, // Store the Firebase key as ClientID
            ClientName: clientName.trim(),
            ClientContact: clientContact.trim(),
            CreateDate: format(now, "yyyy-MM-dd"),
            CreateTime: format(now, "HH:mm"),
            CreatedByUserID: serviceProviderUserId // Associate this client with the service provider
        });

        const providerAppointmentsRefPath = `Appointments/${serviceProviderUserId}`;
        const appointmentsRefForUser = ref(db, providerAppointmentsRefPath);
        const newAppointmentRef = push(appointmentsRefForUser);
        const appointmentId = newAppointmentRef.key;

        await set(newAppointmentRef, {
            AppointmentID: appointmentId,
            ClientID: newClientId, // Link to the newly created client's Firebase key
            ServiceProcedure: serviceProcedure,
            AppointmentDate: selectedFormattedDate,
            AppointmentStartTime: startTime,
            AppointmentEndTime: endTime,
            BookingStatus: "Booked",
            // Notes can be added later by the provider if needed
            BookedByUserID: serviceProviderUserId // The provider who owns this booking
        });

        toast({ title: "Booking Confirmed!", description: `Your appointment for ${serviceProcedure} has been booked.` });
        if(date) fetchBookedSlots(date); // Refresh booked slots for the current view

        // Reset form
        setClientName('');
        setClientContact('');
        setServiceProcedure('');
        setStartTime('');
        setEndTime('');
        // setDate(new Date()); // Optionally reset date or keep it

    } catch (error: any) {
        console.error("Error during public booking:", error);
        toast({ title: "Booking Error", description: error.message || "An unexpected error occurred. Please try again.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (serviceProviderExists === null) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 p-4">
            <svg className="animate-spin mx-auto h-12 w-12 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-muted-foreground">Verifying service provider...</p>
             <footer className="bg-transparent py-4 text-center text-sm text-muted-foreground mt-auto fixed bottom-0">
                © {new Date().getFullYear()} ServiceBooker Pro. All rights reserved.
            </footer>
        </div>
    );
  }

  if (!serviceProviderExists) {
     return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-md shadow-xl p-6 text-center">
                <CardTitle className="text-2xl font-bold text-destructive mb-4">Service Provider Not Found</CardTitle>
                <CardDescription>
                    The booking link is invalid or the service provider could not be found. Please check the link and try again.
                </CardDescription>
            </Card>
            <footer className="bg-transparent py-4 text-center text-sm text-muted-foreground mt-auto fixed bottom-0">
                © {new Date().getFullYear()} ServiceBooker Pro. All rights reserved.
            </footer>
        </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
        <header className="bg-background py-4 shadow-sm sticky top-0 z-50">
            <div className="container max-w-5xl mx-auto flex items-center justify-center">
                 <h1 className="text-2xl font-bold text-primary">Book an Appointment</h1>
            </div>
        </header>
        <main className="flex-grow py-10">
            <div className="container max-w-2xl mx-auto">
                <Card className="shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold text-center text-primary">New Appointment Booking</CardTitle>
                        <CardDescription className="text-center">
                            Fill in your details below to schedule your appointment.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6 p-2 sm:p-0">
                            <div>
                                <Label htmlFor="clientName" className="font-medium">Your Name *</Label>
                                <Input
                                    type="text"
                                    id="clientName"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    required
                                    className="mt-1"
                                    placeholder="Enter your full name"
                                />
                            </div>
                            <div>
                                <Label htmlFor="clientContact" className="font-medium">Your Contact (Phone or Email)</Label>
                                <Input
                                    type="text"
                                    id="clientContact"
                                    value={clientContact}
                                    onChange={(e) => setClientContact(e.target.value)}
                                    className="mt-1"
                                    placeholder="Enter your phone number or email"
                                />
                            </div>
                            <div>
                                <Label htmlFor="serviceProcedure" className="font-medium">Service/Procedure Requested *</Label>
                                <Textarea
                                    id="serviceProcedure"
                                    value={serviceProcedure}
                                    onChange={(e) => setServiceProcedure(e.target.value)}
                                    required
                                    className="mt-1"
                                    placeholder="Describe the service you need"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-6">
                                <div className="flex-1">
                                    <Label htmlFor="date" className="font-medium">Appointment Date *</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal mt-1",
                                                    !date && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {date ? format(date, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <CalendarIconLucideShadcn
                                                mode="single"
                                                selected={date}
                                                onSelect={(selectedDay) => {
                                                    setDate(selectedDay);
                                                    setStartTime(''); // Reset times when date changes
                                                    setEndTime('');
                                                }}
                                                disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="flex-1">
                                    <Label htmlFor="startTime" className="font-medium">Start Time *</Label>
                                    <Select
                                        value={startTime}
                                        onValueChange={setStartTime}
                                        disabled={isLoadingBookedSlots || !date}
                                    >
                                        <SelectTrigger className="w-full mt-1">
                                            <SelectValue placeholder={isLoadingBookedSlots ? "Loading..." : "Select start time"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                             {isLoadingBookedSlots && <SelectItem value="loading" disabled>Loading slots...</SelectItem>}
                                             {!isLoadingBookedSlots && timeSlots.map(slot => (
                                                <SelectItem
                                                    key={`start-${slot}`}
                                                    value={slot}
                                                    disabled={bookedTimeSlotsForDate.has(slot)}
                                                >
                                                    {slot} {bookedTimeSlotsForDate.has(slot) ? "(Unavailable)" : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1">
                                    <Label htmlFor="endTime" className="font-medium">End Time *</Label>
                                    <Select
                                        value={endTime}
                                        onValueChange={setEndTime}
                                        disabled={isLoadingBookedSlots || !date || !startTime}
                                    >
                                        <SelectTrigger className="w-full mt-1">
                                            <SelectValue placeholder={isLoadingBookedSlots ? "Loading..." : "Select end time"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {isLoadingBookedSlots && <SelectItem value="loading" disabled>Loading slots...</SelectItem>}
                                            {!isLoadingBookedSlots && timeSlots.filter(slot => {
                                                if (!startTime) return true; // Show all if start time not yet selected
                                                const baseDateForFilter = date ? new Date(date) : new Date();
                                                baseDateForFilter.setHours(0,0,0,0);
                                                const currentSlotTime = parse(slot, "HH:mm", baseDateForFilter);
                                                const selectedStartTime = parse(startTime, "HH:mm", baseDateForFilter);
                                                return currentSlotTime > selectedStartTime;
                                            }).map(slot => {
                                                let itemIsDisabled = false;
                                                let itemLabelSuffix = "";
                                                if (startTime && date) {
                                                    const baseDateForCheck = new Date(date);
                                                    baseDateForCheck.setHours(0,0,0,0);
                                                    const newBookingStartForCheck = parse(startTime, "HH:mm", baseDateForCheck);
                                                    const potentialEndTime = parse(slot, "HH:mm", baseDateForCheck);
                                                    let tempSlotCheck = newBookingStartForCheck;
                                                    while (tempSlotCheck < potentialEndTime) {
                                                        if (bookedTimeSlotsForDate.has(format(tempSlotCheck, "HH:mm"))) {
                                                            itemIsDisabled = true;
                                                            itemLabelSuffix = "(Conflicts)";
                                                            break;
                                                        }
                                                        tempSlotCheck = addMinutes(tempSlotCheck, 30);
                                                    }
                                                } else if (!startTime){ // Disable if start time isn't picked
                                                    itemIsDisabled = true;
                                                }
                                                return (
                                                    <SelectItem
                                                        key={`end-${slot}`}
                                                        value={slot}
                                                        disabled={itemIsDisabled}
                                                    >
                                                        {slot} {itemLabelSuffix}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {isLoadingBookedSlots && date && (
                                <div className="flex items-center text-sm text-muted-foreground">
                                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                                    Checking available slots for {format(date, "PPP")}...
                                </div>
                            )}
                            <Button type="submit" disabled={isSubmitting || isLoadingBookedSlots} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold py-3 mt-8">
                                {isSubmitting ? (
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : "Request Booking"}
                            </Button>
                        </form>
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

    