
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar as CalendarIconLucideShadcn } from "@/components/ui/calendar"; 
import { cn } from "@/lib/utils";
import { format, addMinutes, parse } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react"; // Added Clock
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Firebase imports for Realtime Database
import { ref, set, get, query as rtQuery, orderByChild, equalTo, push } from "firebase/database";
import { db } from '@/lib/firebaseConfig';

interface ExistingBooking {
  AppointmentStartTime: string;
  AppointmentEndTime: string;
  AppointmentDate: string;
}

function generateAlphanumericID(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

const generateTimeSlots = () => {
  const slots = [];
  let currentTime = new Date();
  currentTime.setHours(6, 0, 0, 0); // Start at 6:00 AM

  const endTimeLimit = new Date();
  endTimeLimit.setHours(21, 0, 0, 0); // End at 9:00 PM (slot itself will be 21:00, meaning booking can end at 21:00)

  while (currentTime <= endTimeLimit) {
    slots.push(format(currentTime, "HH:mm"));
    currentTime = addMinutes(currentTime, 30);
  }
  return slots;
};
const timeSlots = generateTimeSlots();

export default function NewBookingPage() {
    const [clientName, setClientName] = useState('');
    const [clientContact, setClientContact] = useState('');
    const [serviceProcedure, setServiceProcedure] = useState('');
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [bookedTimeSlotsForDate, setBookedTimeSlotsForDate] = useState<Set<string>>(new Set());
    const [isLoadingBookedSlots, setIsLoadingBookedSlots] = useState(false);

    const { currentUser, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!authLoading && !currentUser) {
        router.push('/login');
      }
    }, [currentUser, authLoading, router]);

    const fetchBookedSlots = useCallback(async (selectedDate: Date) => {
      if (!currentUser || !selectedDate) {
        setBookedTimeSlotsForDate(new Set());
        return;
      }
      setIsLoadingBookedSlots(true);
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      const appointmentsRef = ref(db, `Appointments/${currentUser.uid}`);
      const appointmentsQuery = rtQuery(appointmentsRef, orderByChild('AppointmentDate'), equalTo(formattedDate));

      try {
        const snapshot = await get(appointmentsQuery);
        const newBookedSlots = new Set<string>();
        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            const booking = childSnapshot.val() as ExistingBooking;
            try {
              // Ensure date part is consistent for parsing
              const baseDateForParse = new Date(formattedDate); // Use the actual selected date for parsing context
              const slotStartTime = parse(booking.AppointmentStartTime, "HH:mm", baseDateForParse);
              const slotEndTime = parse(booking.AppointmentEndTime, "HH:mm", baseDateForParse);
              
              let currentSlotTime = slotStartTime;
              while (currentSlotTime < slotEndTime) { // Iterate through each 30-min segment of the booking
                newBookedSlots.add(format(currentSlotTime, "HH:mm"));
                currentSlotTime = addMinutes(currentSlotTime, 30);
              }
            } catch (parseError) {
              console.error("Error parsing booking times:", booking, parseError);
            }
          });
        }
        setBookedTimeSlotsForDate(newBookedSlots);
      } catch (error) {
        console.error("Error fetching booked slots:", error);
        toast({
          title: "Error loading booked slots",
          description: "Could not fetch existing bookings for this date.",
          variant: "destructive",
        });
        setBookedTimeSlotsForDate(new Set()); // Clear on error
      } finally {
        setIsLoadingBookedSlots(false);
      }
    }, [currentUser, toast]);

    useEffect(() => {
      if (date && currentUser) { // Ensure currentUser is also available
        fetchBookedSlots(date);
      } else {
        setBookedTimeSlotsForDate(new Set()); // Clear if date or user is removed
      }
    }, [date, currentUser, fetchBookedSlots]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        if (!currentUser) {
            toast({
                title: "Authentication Error",
                description: "You must be logged in to create a booking.",
                variant: "destructive",
            });
            setIsSubmitting(false);
            router.push('/login');
            return;
        }

        if (!clientName || !serviceProcedure || !date || !startTime || !endTime) {
            toast({
                title: "Error",
                description: "Please fill in all required fields.",
                variant: "destructive",
            });
            setIsSubmitting(false);
            return;
        }
        
        const selectedFormattedDate = format(date, "yyyy-MM-dd"); // Ensure date is defined
        const baseDateForSubmitParse = new Date(selectedFormattedDate); // Use actual date for parsing

        const startDateTime = parse(startTime, 'HH:mm', baseDateForSubmitParse);
        const endDateTime = parse(endTime, 'HH:mm', baseDateForSubmitParse);

        if (endDateTime <= startDateTime) {
          toast({
            title: "Validation Error",
            description: "End time must be after start time.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        // Check for overlap again before submitting (more robust check)
        const newBookingStart = startDateTime;
        const newBookingEnd = endDateTime;

        let tempSlot = newBookingStart;
        let hasOverlap = false;
        while(tempSlot < newBookingEnd) {
            if(bookedTimeSlotsForDate.has(format(tempSlot, "HH:mm"))) {
                hasOverlap = true;
                break;
            }
            tempSlot = addMinutes(tempSlot, 30);
        }

        if(hasOverlap) {
            toast({
                title: "Booking Conflict",
                description: "The selected time range overlaps with an existing booking. Please choose different times or date.",
                variant: "destructive",
            });
            setIsSubmitting(false);
            return;
        }


        if (!db) {
            toast({
                title: "Error",
                description: "Firebase Realtime Database is not initialized. Please check your configuration.",
                variant: "destructive",
            });
            setIsSubmitting(false);
            return;
        }

        try {
            let clientIdToUse: string | null = null; 
            const userClientsRefPath = `Clients/${currentUser.uid}`;
            const clientsRef = ref(db, userClientsRefPath);
            const clientQuery = rtQuery(clientsRef, orderByChild('ClientName'), equalTo(clientName));
            const clientSnapshot = await get(clientQuery);

            if (clientSnapshot.exists()) {
                clientSnapshot.forEach((childSnapshot) => {
                    if (!clientIdToUse) { 
                        clientIdToUse = childSnapshot.key as string;
                    }
                });
            }
            
            if (!clientIdToUse) { 
                clientIdToUse = generateAlphanumericID(10); 
                const now = new Date();
                const createDate = now.toISOString().split('T')[0]; 
                const createTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); 

                await set(ref(db, `${userClientsRefPath}/${clientIdToUse}`), {
                    ClientID: clientIdToUse, 
                    ClientName: clientName,
                    ClientContact: clientContact,
                    CreateDate: createDate,
                    CreateTime: createTime,
                    CreatedByUserID: currentUser.uid 
                });
            }

            const userAppointmentsRefPath = `Appointments/${currentUser.uid}`;
            const appointmentsRefForUser = ref(db, userAppointmentsRefPath);
            const newAppointmentRef = push(appointmentsRefForUser); 
            const appointmentId = newAppointmentRef.key; 
            
            await set(newAppointmentRef, {
                AppointmentID: appointmentId, 
                ClientID: clientIdToUse, 
                ServiceProcedure: serviceProcedure,
                AppointmentDate: selectedFormattedDate,
                AppointmentStartTime: startTime,
                AppointmentEndTime: endTime,
                BookedByUserID: currentUser.uid 
            });

            toast({
                title: "Success",
                description: "Booking Confirmed!",
            });
            
            if(date) fetchBookedSlots(date); // Refresh booked slots for the current date

            setClientName('');
            setClientContact('');
            setServiceProcedure('');
            setStartTime('');
            setEndTime('');

        } catch (error: any) {
            console.error("Error during booking:", error);
            toast({
                title: "Error creating booking",
                description: error.message || "An unexpected error occurred.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
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
                    <p className="mt-4 text-muted-foreground">Loading form...</p>
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
                <div className="container max-w-2xl mx-auto">
                    <h1 className="text-3xl font-bold mb-8 text-center text-primary">New Booking</h1>
                    <form onSubmit={handleSubmit} className="space-y-6 bg-card p-8 rounded-lg shadow-xl">
                        <div>
                            <Label htmlFor="clientName" className="font-medium">Client Name *</Label>
                            <Input
                                type="text"
                                id="clientName"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                required
                                className="mt-1"
                                placeholder="Enter client's full name"
                            />
                        </div>
                        <div>
                            <Label htmlFor="clientContact" className="font-medium">Client Contact (Phone or Email)</Label>
                            <Input
                                type="text"
                                id="clientContact"
                                value={clientContact}
                                onChange={(e) => setClientContact(e.target.value)}
                                className="mt-1"
                                placeholder="Enter phone or email"
                            />
                        </div>
                        <div>
                            <Label htmlFor="serviceProcedure" className="font-medium">Service/Procedure *</Label>
                            <Textarea
                                id="serviceProcedure"
                                value={serviceProcedure}
                                onChange={(e) => setServiceProcedure(e.target.value)}
                                required
                                className="mt-1"
                                placeholder="Describe the service or procedure"
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
                                                setEndTime('');   
                                            }}
                                            disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                             <div className="flex-1">
                                <Label htmlFor="startTime" className="font-medium">Appointment Start Time *</Label>
                                <Select 
                                    value={startTime} 
                                    onValueChange={setStartTime} 
                                    disabled={isLoadingBookedSlots || !date}
                                    required
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
                                                {slot} {bookedTimeSlotsForDate.has(slot) ? "(Booked)" : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1">
                                <Label htmlFor="endTime" className="font-medium">Appointment End Time *</Label>
                                 <Select 
                                    value={endTime} 
                                    onValueChange={setEndTime} 
                                    disabled={isLoadingBookedSlots || !date || !startTime}
                                    required
                                 >
                                    <SelectTrigger className="w-full mt-1">
                                        <SelectValue placeholder={isLoadingBookedSlots ? "Loading..." : "Select end time"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isLoadingBookedSlots && <SelectItem value="loading" disabled>Loading slots...</SelectItem>}
                                        {!isLoadingBookedSlots && timeSlots.filter(slot => {
                                             if (!startTime) return true; 
                                             const currentSlotTime = parse(slot, "HH:mm", new Date()); // Base date for comparison only
                                             const selectedStartTime = parse(startTime, "HH:mm", new Date()); // Base date for comparison only
                                             return currentSlotTime > selectedStartTime;
                                        }).map(slot => {
                                            let itemIsDisabled = false;
                                            let itemLabelSuffix = "";
                                            if (startTime && date) {
                                                const newBookingStartForCheck = parse(startTime, "HH:mm", new Date(date));
                                                const potentialEndTime = parse(slot, "HH:mm", new Date(date));
                                                
                                                let tempSlotCheck = newBookingStartForCheck;
                                                while (tempSlotCheck < potentialEndTime) {
                                                    if (bookedTimeSlotsForDate.has(format(tempSlotCheck, "HH:mm"))) {
                                                        itemIsDisabled = true;
                                                        itemLabelSuffix = "(Conflicts)";
                                                        break;
                                                    }
                                                    tempSlotCheck = addMinutes(tempSlotCheck, 30);
                                                }
                                            } else {
                                                itemIsDisabled = true; // Should be covered by overall select disabled state
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
                         {isLoadingBookedSlots && (
                            <div className="flex items-center text-sm text-muted-foreground">
                                <Clock className="mr-2 h-4 w-4 animate-spin" />
                                Checking available slots...
                            </div>
                        )}
                        <Separator className="my-4" />
                        <Button type="submit" disabled={isSubmitting || isLoadingBookedSlots} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold py-3">
                             {isSubmitting ? (
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : "Submit Booking"}
                        </Button>
                    </form>
                </div>
            </main>
            <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">
                 © {new Date().getFullYear()} ServiceBooker Pro. All rights reserved.
            </footer>
        </div>
    );
}

