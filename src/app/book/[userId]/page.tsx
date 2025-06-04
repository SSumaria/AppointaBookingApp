
"use client";

console.log("--- PublicBookingPage (/book/[userId]/page.tsx) --- MODULE SCRIPT EXECUTING (TOP LEVEL)");

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Calendar as CalendarIconLucideShadcn } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, addMinutes, parse } from "date-fns";
import { Calendar as CalendarIcon, Clock, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


import { ref, set, get, query as rtQuery, orderByChild, equalTo, push } from "firebase/database";
import { db } from '@/lib/firebaseConfig'; 

interface ExistingBooking {
  AppointmentStartTime: string;
  AppointmentEndTime: string;
  AppointmentDate: string;
  BookingStatus?: string;
}

const generateTimeSlots = () => {
  const slots = [];
  let currentTime = new Date();
  currentTime.setHours(6, 0, 0, 0); 

  const endTimeLimit = new Date();
  endTimeLimit.setHours(21, 0, 0, 0); 

  while (currentTime <= endTimeLimit) {
    slots.push(format(currentTime, "HH:mm"));
    currentTime = addMinutes(currentTime, 30);
  }
  return slots;
};
const timeSlots = generateTimeSlots();

export default function PublicBookingPage() {
  console.log("--- PublicBookingPage (/book/[userId]/page.tsx) --- COMPONENT RENDERING ---");
  const params = useParams();
  const serviceProviderUserId = params.userId as string;
  console.log(`PublicBookingPage: Service Provider User ID from URL params: '${serviceProviderUserId}'`);
  
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [serviceProcedure, setServiceProcedure] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('');
  const [endTimeInput, setEndTimeInput] = useState('');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // serviceProviderExists will be null initially (loading), then true/false
  const [serviceProviderExists, setServiceProviderExists] = useState<boolean | null>(null);
  const [initialCheckDone, setInitialCheckDone] = useState(false);


  const [bookedTimeSlotsForDate, setBookedTimeSlotsForDate] = useState<Set<string>>(new Set());
  const [isLoadingBookedSlots, setIsLoadingBookedSlots] = useState(false);

  useEffect(() => {
    const checkServiceProvider = async () => {
      console.log(`PublicBookingPage: checkServiceProvider called for User ID: '${serviceProviderUserId}'. This check verifies provider existing data.`);

      if (!serviceProviderUserId) {
        console.log("PublicBookingPage: No serviceProviderUserId available from URL params. Setting provider check as done, exists = false.");
        setServiceProviderExists(false);
        setInitialCheckDone(true);
        return;
      }
      if (!db) {
        console.error("PublicBookingPage: Firebase DB is not initialized. Cannot check service provider. Critical config issue.");
        setServiceProviderExists(false); // Treat as non-existent if DB fails
        setInitialCheckDone(true);
        toast({ title: "Error", description: "Booking system is currently unavailable. Please try again later.", variant: "destructive" });
        return;
      }

      let providerDataFound = false;
      let attemptedPathForError = ""; 

      try {
        const apptRefPath = `Appointments/${serviceProviderUserId}`;
        attemptedPathForError = apptRefPath;
        console.log(`PublicBookingPage: Attempting to read from Appointments path: '${apptRefPath}'`);
        const apptRef = ref(db, apptRefPath);
        const apptSnapshot = await get(apptRef);

        if (apptSnapshot.exists()) {
          const apptData = apptSnapshot.val();
          if (apptData && Object.keys(apptData).length > 0) {
            console.log(`PublicBookingPage: Data FOUND in Appointments for ID '${serviceProviderUserId}'. Provider has existing data. Keys:`, Object.keys(apptData).length);
            providerDataFound = true;
          } else {
            console.log(`PublicBookingPage: Data node EXISTS in Appointments for ID '${serviceProviderUserId}', but it's EMPTY.`);
          }
        } else {
          console.log(`PublicBookingPage: NO data node found at Appointments path for ID '${serviceProviderUserId}'.`);
        }

        if (!providerDataFound) {
          const clientRefPath = `Clients/${serviceProviderUserId}`;
          attemptedPathForError = clientRefPath;
          console.log(`PublicBookingPage: Attempting to read from Clients path: '${clientRefPath}'`);
          const clientRef = ref(db, clientRefPath);
          const clientSnapshot = await get(clientRef);

          if (clientSnapshot.exists()) {
            const clientData = clientSnapshot.val();
            if (clientData && Object.keys(clientData).length > 0) {
              console.log(`PublicBookingPage: Data FOUND in Clients for ID '${serviceProviderUserId}'. Provider has existing data. Keys:`, Object.keys(clientData).length);
              providerDataFound = true;
            } else {
              console.log(`PublicBookingPage: Data node EXISTS in Clients for ID '${serviceProviderUserId}', but it's EMPTY.`);
            }
          } else {
            console.log(`PublicBookingPage: NO data node found at Clients path for ID '${serviceProviderUserId}'.`);
          }
        }
        
        if (providerDataFound) {
            console.log(`PublicBookingPage: Provider data VERIFIED for ID '${serviceProviderUserId}'. Setting serviceProviderExists to true.`);
            setServiceProviderExists(true);
        } else {
            console.log(`PublicBookingPage: Provider data NOT VERIFIED for ID '${serviceProviderUserId}' (no data or empty data in Appointments/Clients). Setting serviceProviderExists to false.`);
            setServiceProviderExists(false);
        }

      } catch (error: any) {
        let detailedErrorMessage = "An unexpected error occurred.";
        if (error instanceof Error) detailedErrorMessage = error.message;
        else if (typeof error === 'string') detailedErrorMessage = error;
        const errorCode = error.code ? ` (Code: ${error.code})` : '';
        
        if (error.code === 'PERMISSION_DENIED') {
             console.error(`PublicBookingPage: CRITICAL - PERMISSION DENIED while checking service provider ID '${serviceProviderUserId}'. Path: '${attemptedPathForError}'. Error: ${detailedErrorMessage}${errorCode}`, error);
             toast({ 
                title: "Error Verifying Provider", 
                description: `Database access denied for path '${attemptedPathForError}'. Please check Firebase rules. Details: ${detailedErrorMessage}${errorCode}`, 
                variant: "destructive", duration: 10000 
            });
        } else {
            console.error(`PublicBookingPage: Error during database check for ID '${serviceProviderUserId}'${errorCode}: ${detailedErrorMessage}`, error);
             toast({ 
                title: "Error Verifying Provider", 
                description: `Could not verify service provider. Details: ${detailedErrorMessage}${errorCode}`, 
                variant: "destructive", duration: 10000
            });
        }
        setServiceProviderExists(false); // Assume non-existent on error
      } finally {
        setInitialCheckDone(true);
      }
    };

    if (serviceProviderUserId) {
        checkServiceProvider();
    } else {
        console.log("PublicBookingPage: useEffect for checkServiceProvider - serviceProviderUserId is missing from URL. Setting check as done.");
        setServiceProviderExists(false);
        setInitialCheckDone(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceProviderUserId, toast]); // Only run when serviceProviderUserId from URL changes


  const fetchBookedSlots = useCallback(async (selectedDate: Date) => {
    if (!serviceProviderUserId || !selectedDate) {
      setBookedTimeSlotsForDate(new Set());
      return;
    }
    setIsLoadingBookedSlots(true);
    const formattedDate = format(selectedDate, "yyyy-MM-dd");
    const appointmentsRefPath = `Appointments/${serviceProviderUserId}`;
    console.log(`PublicBookingPage: Fetching booked slots for provider '${serviceProviderUserId}' on date '${formattedDate}' from path '${appointmentsRefPath}'`);
    const appointmentsRef = ref(db, appointmentsRefPath);
    const appointmentsQuery = rtQuery(appointmentsRef, orderByChild('AppointmentDate'), equalTo(formattedDate));

    try {
      const snapshot = await get(appointmentsQuery);
      const newBookedSlots = new Set<string>();
      if (snapshot.exists()) {
        console.log(`PublicBookingPage: Found ${snapshot.size} bookings for provider '${serviceProviderUserId}' on '${formattedDate}'.`);
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
                console.error("PublicBookingPage: Error parsing booking times from DB:", booking, parseError);
              }
          }
        });
      } else {
        console.log(`PublicBookingPage: No bookings found for provider '${serviceProviderUserId}' on '${formattedDate}'.`);
      }
      setBookedTimeSlotsForDate(newBookedSlots);
    } catch (error: any) {
      console.error("PublicBookingPage: Error fetching booked slots:", error);
      toast({
        title: "Error loading schedule",
        description: `Could not fetch existing bookings. Error: ${error.message}`,
        variant: "destructive",
      });
      setBookedTimeSlotsForDate(new Set());
    } finally {
      setIsLoadingBookedSlots(false);
    }
  }, [serviceProviderUserId, toast]);

  useEffect(() => {
    if (date && serviceProviderUserId && initialCheckDone) { // Run after initial check for provider is done
      fetchBookedSlots(date);
    }
  }, [date, serviceProviderUserId, initialCheckDone, fetchBookedSlots]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!serviceProviderUserId) {
        toast({ title: "Error", description: "Service provider ID is missing from the link. Cannot process booking.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }
    
    if (!clientName || !serviceProcedure || !date || !startTime || !endTimeInput) {
        toast({ title: "Error", description: "Please fill in all required fields.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    const selectedFormattedDate = format(date, "yyyy-MM-dd");
    const baseDateForSubmitParse = new Date(selectedFormattedDate + "T00:00:00");
    const startDateTime = parse(startTime, 'HH:mm', baseDateForSubmitParse);
    const endDateTime = parse(endTimeInput, 'HH:mm', baseDateForSubmitParse);

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
        if (date) fetchBookedSlots(date); 
        return;
    }


    if (!db) {
        toast({ title: "Error", description: "Database not initialized. Cannot process booking.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    try {
        // Note: serviceProviderUserId from URL is used directly.
        // The application assumes this ID is the target for client and appointment records.
        const providerClientsRefPath = `Clients/${serviceProviderUserId}`;
        const clientsDbRef = ref(db, providerClientsRefPath);
        const newClientRef = push(clientsDbRef);
        const newClientId = newClientRef.key as string;
        const now = new Date();

        await set(newClientRef, {
            ClientID: newClientId,
            ClientName: clientName.trim(),
            ClientContact: clientContact.trim(),
            CreateDate: format(now, "yyyy-MM-dd"),
            CreateTime: format(now, "HH:mm"),
            CreatedByUserID: serviceProviderUserId 
        });

        const providerAppointmentsRefPath = `Appointments/${serviceProviderUserId}`;
        const appointmentsRefForUser = ref(db, providerAppointmentsRefPath);
        const newAppointmentRef = push(appointmentsRefForUser);
        const appointmentId = newAppointmentRef.key;

        await set(newAppointmentRef, {
            AppointmentID: appointmentId,
            ClientID: newClientId, 
            ServiceProcedure: serviceProcedure,
            AppointmentDate: selectedFormattedDate,
            AppointmentStartTime: startTime,
            AppointmentEndTime: endTimeInput,
            BookingStatus: "Booked",
            BookedByUserID: serviceProviderUserId 
        });

        toast({ title: "Booking Confirmed!", description: `Your appointment for ${serviceProcedure} has been booked.` });
        if(date) fetchBookedSlots(date); 

        setClientName('');
        setClientContact('');
        setServiceProcedure('');
        setStartTime('');
        setEndTimeInput('');
        
    } catch (error: any) {
        console.error("Error during public booking submission:", error);
        toast({ title: "Booking Error", description: error.message || "An unexpected error occurred. Please try again.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!serviceProviderUserId) {
     return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-md shadow-xl p-6 text-center">
                <CardTitle className="text-2xl font-bold text-destructive mb-4">Invalid Booking Link</CardTitle>
                <CardDescription>
                    The booking link is incomplete or invalid. Please ensure you have the correct link.
                </CardDescription>
            </Card>
            <footer className="bg-transparent py-4 text-center text-sm text-muted-foreground mt-auto fixed bottom-0">
                © {new Date().getFullYear()} ServiceBooker Pro. All rights reserved.
            </footer>
        </div>
    );
  }

  if (!initialCheckDone) { 
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 p-4">
            <svg className="animate-spin mx-auto h-12 w-12 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-muted-foreground">Verifying booking link, please wait...</p>
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
                 {serviceProviderExists === false && initialCheckDone && (
                    <Alert variant="default" className="mb-6 bg-yellow-50 border-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300">
                        <AlertTriangle className="h-4 w-4 !text-yellow-600 dark:!text-yellow-400" />
                        <AlertTitle>Notice</AlertTitle>
                        <AlertDescription>
                            This booking link appears to be for a new or unrecognized service provider. 
                            Your booking will proceed and create a record for them.
                        </AlertDescription>
                    </Alert>
                )}
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
                                                    setStartTime(''); 
                                                    setEndTimeInput('');
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
                                        value={endTimeInput}
                                        onValueChange={setEndTimeInput}
                                        disabled={isLoadingBookedSlots || !date || !startTime} 
                                    >
                                        <SelectTrigger className="w-full mt-1">
                                            <SelectValue placeholder={isLoadingBookedSlots ? "Loading..." : "Select end time"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {isLoadingBookedSlots && <SelectItem value="loading" disabled>Loading slots...</SelectItem>}
                                            {!isLoadingBookedSlots && timeSlots.filter(slot => {
                                                if (!startTime) return true; 
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
                                                } else if (!startTime){ 
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

