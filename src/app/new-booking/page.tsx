
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Calendar as CalendarIconLucideShadcn } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, addMinutes, parse, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Clock, User, StickyNote, Mail, Phone, Briefcase } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import { ref, set, get, query as rtQuery, orderByChild, equalTo, push, startAt, endAt, update } from "firebase/database";
import { db } from '@/lib/firebaseConfig';

interface Note {
  id: string;
  text: string;
  timestamp: number;
}

interface ExistingBooking {
  AppointmentStartTime: string;
  AppointmentEndTime: string;
  AppointmentDate: string;
  BookingStatus?: string;
}

interface ClientData {
    ClientID: string;
    ClientName: string;
    ClientEmail?: string;
    ClientContact?: string;
}

interface ClientSuggestion extends ClientData {
  id: string; // Firebase key
}

const generateTimeSlots = (interval: 15 | 30 | 60) => {
  const slots = [];
  let currentTime = new Date();
  currentTime.setHours(6, 0, 0, 0);

  const endTimeLimit = new Date();
  endTimeLimit.setHours(21, 0, 0, 0);

  while (currentTime <= endTimeLimit) {
    slots.push(format(currentTime, "HH:mm"));
    currentTime = addMinutes(currentTime, interval);
  }
  return slots;
};

const generateNoteId = () => {
  return Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
};

export default function NewBookingPage() {
    const [clientName, setClientName] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [serviceProcedure, setServiceProcedure] = useState('');
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [notesInput, setNotesInput] = useState('');
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [clientPhone, setClientPhone] = useState('');
    const [bookedTimeSlotsForDate, setBookedTimeSlotsForDate] = useState<Set<string>>(new Set());
    const [isLoadingBookedSlots, setIsLoadingBookedSlots] = useState(false);

    const { currentUser, loading: authLoading } = useAuth();
    const router = useRouter();

    const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedClientFirebaseKey, setSelectedClientFirebaseKey] = useState<string | null>(null);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    const [timeInterval, setTimeInterval] = useState<15 | 30 | 60>(30);
    const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);

    const timeSlots = useMemo(() => generateTimeSlots(timeInterval), [timeInterval]);

    const fetchBookingPreferences = useCallback(async (userId: string) => {
        if (!db) return;
        setIsLoadingPreferences(true);
        try {
            const settingsRef = ref(db, `UserPreferences/${userId}/bookingSettings`);
            const snapshot = await get(settingsRef);
            if (snapshot.exists()) {
                const settings = snapshot.val();
                if (settings.timeInterval && [15, 30, 60].includes(settings.timeInterval)) {
                    setTimeInterval(settings.timeInterval);
                }
            }
        } catch (error) {
            console.error("Could not fetch booking preferences, using default.", error);
        } finally {
            setIsLoadingPreferences(false);
        }
    }, []);

    useEffect(() => {
        if (currentUser) {
            fetchBookingPreferences(currentUser.uid);
        } else if (!authLoading) {
            setIsLoadingPreferences(false);
        }
    }, [currentUser, authLoading, fetchBookingPreferences]);


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
      const userAppointmentsRefPath = `Appointments/${currentUser.uid}`;
      const appointmentsRef = ref(db, userAppointmentsRefPath);
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
                console.error("Error parsing booking times:", booking, parseError);
              }
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
        setBookedTimeSlotsForDate(new Set());
      } finally {
        setIsLoadingBookedSlots(false);
      }
    }, [currentUser, toast]);

    useEffect(() => {
      if (date && currentUser) {
        fetchBookedSlots(date);
      } else {
        setBookedTimeSlotsForDate(new Set());
      }
    }, [date, currentUser, fetchBookedSlots]);

    const handleClientNameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setClientName(query);
        setSelectedClientFirebaseKey(null); 
        
        if (query.trim() === '') {
         setClientEmail(''); 
         setClientPhone(''); 
        }

        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        if (query.trim().length > 0) {
            debounceTimeoutRef.current = setTimeout(async () => {
                if (!currentUser?.uid) return;
                const userClientsRefPath = `Clients/${currentUser.uid}`;
                const clientsRef = ref(db, userClientsRefPath);
                const searchQuery = rtQuery(
                    clientsRef,
                    orderByChild('ClientName'),
                    startAt(query),
                    endAt(query + '\uf8ff')
                );
                try {
                    const snapshot = await get(searchQuery);
                    const fetchedSuggestions: ClientSuggestion[] = [];
                    if (snapshot.exists()) {
                        snapshot.forEach((childSnapshot) => {
                            fetchedSuggestions.push({
                                id: childSnapshot.key as string,
                                ...childSnapshot.val() as ClientData,
                            });
                        });
                    }
                    setSuggestions(fetchedSuggestions.slice(0, 5)); 
                    setShowSuggestions(true);
                } catch (error) {
                    console.error("Error fetching client suggestions:", error);
                    setSuggestions([]);
                }
            }, 300);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (suggestion: ClientSuggestion) => {
        setClientName(suggestion.ClientName);
        setClientEmail(suggestion.ClientEmail || ''); 
        setClientPhone(suggestion.ClientContact || ''); 
        setSelectedClientFirebaseKey(suggestion.id);
        setShowSuggestions(false);
        setSuggestions([]);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [suggestionsRef]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        if (!currentUser || !currentUser.email) {
            toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
            setIsSubmitting(false);
            router.push('/login');
            return;
        }

        if (!clientName.trim() || !clientEmail.trim() || !clientPhone.trim() || !serviceProcedure || !date || !startTime || !endTime) {
            toast({ title: "Error", description: "All fields except Notes are required.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }

        const selectedFormattedDate = format(date, "yyyy-MM-dd");
        const baseDateForSubmitParse = new Date(selectedFormattedDate + "T00:00:00");
        const startDateTime = parse(startTime, 'HH:mm', baseDateForSubmitParse);
        const endDateTime = parse(endTime, 'HH:mm', baseDateForSubmitParse);

        if (endDateTime <= startDateTime) {
            toast({ title: "Invalid Time", description: "End time must be after start time.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }

        let tempSlot = startDateTime;
        let hasOverlap = false;
        while(tempSlot < endDateTime) {
            // Check conflicts at 30min intervals regardless of chosen precision to catch all overlaps
            if(bookedTimeSlotsForDate.has(format(tempSlot, "HH:mm"))) {
                hasOverlap = true;
                break;
            }
            tempSlot = addMinutes(tempSlot, 30);
        }

        if(hasOverlap) {
            toast({ title: "Booking Conflict", description: "The selected time range overlaps with an existing booking.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }

        if (!db) {
            toast({ title: "Error", description: "Database not initialized.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }

        let determinedClientId: string | null = null;
        let finalClientNameForAppointment = clientName.trim();
        let finalClientEmailForAppointment = clientEmail.trim().toLowerCase(); 
        let finalClientPhoneForAppointment = clientPhone.trim();

        const finalNotes: Note[] = [];
        if (notesInput.trim()) {
          finalNotes.push({
            id: generateNoteId(),
            text: notesInput.trim(),
            timestamp: Date.now(),
          });
        }

        try {
            if (selectedClientFirebaseKey) {
                // Path 1: Client was selected from suggestions
                const clientRef = ref(db, `Clients/${currentUser.uid}/${selectedClientFirebaseKey}`);
                const snapshot = await get(clientRef);

                if (snapshot.exists()) {
                    determinedClientId = selectedClientFirebaseKey; 
                    const clientDataFromDB = snapshot.val() as ClientData;
                    
                    finalClientNameForAppointment = clientDataFromDB.ClientName; 
                    finalClientPhoneForAppointment = clientDataFromDB.ClientContact || ''; 

                    const formEmailLower = clientEmail.trim().toLowerCase();
                    
                    if (clientDataFromDB.ClientEmail !== formEmailLower) {
                        await update(clientRef, { ClientEmail: formEmailLower });
                        finalClientEmailForAppointment = formEmailLower; 
                        toast({ title: "Client Email Updated", description: `Email for ${clientDataFromDB.ClientName} updated to ${formEmailLower}.`});
                    } else {
                        finalClientEmailForAppointment = clientDataFromDB.ClientEmail; 
                    }
                } else {
                    toast({ title: "Error", description: "Selected client not found. Please try again.", variant: "destructive" });
                    setIsSubmitting(false);
                    return;
                }
            } else {
                // Path 2: No client selected - find by email (lowercase) or create new
                const clientsDbRef = ref(db, `Clients/${currentUser.uid}`);
                const emailToQuery = clientEmail.trim().toLowerCase();
                const clientQuery = rtQuery(clientsDbRef, orderByChild('ClientEmail'), equalTo(emailToQuery));
                const existingClientSnapshot = await get(clientQuery);

                if (existingClientSnapshot.exists()) {
                    existingClientSnapshot.forEach((childSnapshot) => { 
                        determinedClientId = childSnapshot.key as string;
                        const data = childSnapshot.val();
                        finalClientNameForAppointment = data.ClientName;
                        finalClientEmailForAppointment = data.ClientEmail; 
                        finalClientPhoneForAppointment = data.ClientContact || '';
                        return true; 
                    });
                } else {
                    const newClientRef = push(clientsDbRef);
                    determinedClientId = newClientRef.key as string;
                    const now = new Date();
                    await set(newClientRef, {
                        ClientID: determinedClientId,
                        ClientName: clientName.trim(), 
                        ClientContact: clientPhone.trim(), 
                        ClientEmail: clientEmail.trim().toLowerCase(),
                        CreateDate: format(now, "yyyy-MM-dd"),
                        CreateTime: format(now, "HH:mm"),
                        CreatedByUserID: currentUser.uid
                    });
                }
            }

            if (!determinedClientId) {
                toast({ title: "Client ID Error", description: "Could not establish a client ID for the booking.", variant: "destructive" });
                setIsSubmitting(false);
                return;
            }

            // Proceed to create appointment
            const userAppointmentsRefPath = `Appointments/${currentUser.uid}`;
            const appointmentsRefForUser = ref(db, userAppointmentsRefPath);
            const newAppointmentRef = push(appointmentsRefForUser);
            const appointmentId = newAppointmentRef.key;
            if (!appointmentId) throw new Error("Could not generate appointment ID.");

            await set(newAppointmentRef, {
                AppointmentID: appointmentId,
                ClientID: determinedClientId, 
                ServiceProcedure: serviceProcedure,
                AppointmentDate: selectedFormattedDate,
                AppointmentStartTime: startTime,
                AppointmentEndTime: endTime,
                BookingStatus: "Booked",
                Notes: finalNotes,
                BookedByUserID: currentUser.uid,
                _ClientNameSnapshot: finalClientNameForAppointment,
                _ClientEmailSnapshot: finalClientEmailForAppointment,
                _ClientPhoneSnapshot: finalClientPhoneForAppointment,
            });

             // Send email notifications via API route
            try {
                const emailPayload = {
                    action: 'sendConfirmation',
                    providerEmail: currentUser.email,
                    clientName: finalClientNameForAppointment,
                    clientEmail: finalClientEmailForAppointment,
                    appointmentDate: format(parseISO(selectedFormattedDate), "PPP"),
                    appointmentTime: `${startTime} - ${endTime}`,
                    service: serviceProcedure,
                };

                await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(emailPayload)
                });
                toast({ title: "Success", description: `Booking Confirmed for ${finalClientNameForAppointment}! Notification logs generated.` });
            } catch(emailError) {
                console.error("Failed to call send-email API:", emailError);
                toast({ title: "Booking Confirmed (Email API Failed)", description: "The booking was saved, but email notification API failed.", variant: "destructive" });
            }
            
            // Sync to Google Calendar (fire-and-forget)
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            fetch('/api/google-calendar-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'create',
                bookingId: appointmentId,
                userId: currentUser.uid,
                timeZone: timeZone,
              })
            }).then(res => res.json()).then(data => {
              if (data.success) {
                console.log("Successfully synced new booking to Google Calendar.");
              } else {
                console.warn("Failed to sync new booking to Google Calendar:", data.message);
              }
            }).catch(err => {
              console.error("Error calling calendar sync API:", err);
            });


            if(date) fetchBookedSlots(date);

            // Reset form fields
            setClientName('');
            setClientEmail(''); 
            setClientPhone(''); 
            setServiceProcedure('');
            setNotesInput('');
            setStartTime('');
            setEndTime('');
            setSelectedClientFirebaseKey(null); 
            setShowSuggestions(false); 

        } catch (error: any) {
            console.error("Error during booking:", error);
            toast({ title: "Error creating booking", description: error.message || "An unexpected error occurred.", variant: "destructive" });
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
                © {new Date().getFullYear()} Appointa. All rights reserved.
            </footer>
        </div>
      );
    }

    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-grow py-10">
                <div className="container max-w-2xl mx-auto">
                    <Card className="shadow-xl">
                        <CardHeader className="text-center">
                            <CardTitle className="text-3xl font-bold text-primary">New Booking</CardTitle>
                            <CardDescription>Fill out the form below to create a new appointment for an existing or new client.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form id="new-booking-form" onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium text-muted-foreground">Client Details</h3>
                                    <div className="relative" ref={suggestionsRef}>
                                        <Label htmlFor="clientName" className="font-medium flex items-center">
                                            <User className="mr-2 h-4 w-4" /> Client Name *
                                        </Label>
                                        <Input
                                            type="text"
                                            id="clientName"
                                            value={clientName}
                                            onChange={handleClientNameChange}
                                            onFocus={() => clientName.trim().length > 0 && suggestions.length > 0 && setShowSuggestions(true)}
                                            required
                                            autoComplete="off"
                                            className="mt-1"
                                            placeholder="Start typing to search existing clients..."
                                        />
                                        {showSuggestions && suggestions.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                {suggestions.map((suggestion) => (
                                                    <div
                                                        key={suggestion.id}
                                                        className="px-3 py-2 border-2 border-transparent hover:border-primary cursor-pointer text-sm"
                                                        onClick={() => handleSuggestionClick(suggestion)}
                                                    >
                                                        {suggestion.ClientName} 
                                                        {suggestion.ClientContact && <span className="text-xs text-muted-foreground ml-2">({suggestion.ClientContact})</span>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <Label htmlFor="clientEmail" className="font-medium flex items-center">
                                            <Mail className="mr-2 h-4 w-4" /> Client Email *
                                        </Label>
                                        <Input
                                            type="email" 
                                            id="clientEmail"
                                            value={clientEmail}
                                            onChange={(e) => setClientEmail(e.target.value)}
                                            required
                                            className="mt-1"
                                            placeholder="name@example.com"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="clientPhone" className="font-medium flex items-center">
                                            <Phone className="mr-2 h-4 w-4" /> Client Phone Number *
                                        </Label>
                                        <Input
                                            type="tel" 
                                            id="clientPhone"
                                            value={clientPhone}
                                            onChange={(e) => setClientPhone(e.target.value)}
                                            required
                                            className="mt-1"
                                            placeholder="(123) 456-7890"
                                        />
                                    </div>
                                </div>
                                
                                <Separator />

                                <div className="space-y-4">
                                     <h3 className="text-lg font-medium text-muted-foreground">Appointment Details</h3>
                                    <div>
                                        <Label htmlFor="serviceProcedure" className="font-medium flex items-center">
                                            <Briefcase className="mr-2 h-4 w-4" /> Service/Procedure *
                                        </Label>
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
                                            <Label htmlFor="date">Appointment Date *</Label>
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
                                            <Label htmlFor="startTime">Start Time *</Label>
                                            <Select
                                                value={startTime}
                                                onValueChange={(value) => {
                                                  setStartTime(value);
                                                  setEndTime('');
                                                }}
                                                disabled={isLoadingBookedSlots || !date}
                                            >
                                                <SelectTrigger className="w-full mt-1">
                                                    <SelectValue placeholder={isLoadingBookedSlots || isLoadingPreferences ? "Loading..." : "Select time"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(isLoadingBookedSlots || isLoadingPreferences) && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                                                    {!isLoadingBookedSlots && !isLoadingPreferences && timeSlots.map(slot => (
                                                        <SelectItem
                                                            key={`start-${slot}`}
                                                            value={slot}
                                                            disabled={bookedTimeSlotsForDate.has(slot)}
                                                        >
                                                            {slot}{bookedTimeSlotsForDate.has(slot) ? " (Booked)" : ""}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex-1">
                                            <Label htmlFor="endTime">End Time *</Label>
                                            <Select
                                                value={endTime}
                                                onValueChange={setEndTime}
                                                disabled={isLoadingBookedSlots || !date || !startTime}
                                            >
                                                <SelectTrigger className="w-full mt-1">
                                                    <SelectValue placeholder={isLoadingBookedSlots || isLoadingPreferences ? "Loading..." : "Select time"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                   {(isLoadingBookedSlots || isLoadingPreferences) && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                                                   {!isLoadingBookedSlots && !isLoadingPreferences && timeSlots.filter(slot => {
                                                       if (!startTime || !date) return true;
                                                       const baseDate = new Date(date); baseDate.setHours(0,0,0,0);
                                                       return parse(slot, "HH:mm", baseDate) > parse(startTime, "HH:mm", baseDate);
                                                   }).map(slot => {
                                                        let itemIsDisabled = false;
                                                        let itemLabelSuffix = "";
                                                        if (startTime && date) {
                                                            const baseDate = new Date(date); baseDate.setHours(0,0,0,0);
                                                            const newBookingStart = parse(startTime, "HH:mm", baseDate);
                                                            const potentialEnd = parse(slot, "HH:mm", baseDate);
                                                            let tempCheck = addMinutes(newBookingStart, 30); // Start checking from the next 30min slot
                                                            while (tempCheck < potentialEnd) {
                                                                if (bookedTimeSlotsForDate.has(format(tempCheck, "HH:mm"))) {
                                                                    itemIsDisabled = true;
                                                                    itemLabelSuffix = " (Conflicts)";
                                                                    break;
                                                                }
                                                                tempCheck = addMinutes(tempCheck, 30);
                                                            }
                                                        } else {
                                                          itemIsDisabled = true;
                                                        }
                                                        return (
                                                          <SelectItem key={`end-${slot}`} value={slot} disabled={itemIsDisabled}>
                                                            {slot}{itemLabelSuffix}
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
                                            Checking available slots for {date ? format(date, "PPP") : 'selected date'}...
                                        </div>
                                    )}
                                </div>
                                
                                <Separator />

                                <div>
                                    <Label htmlFor="bookingNotes" className="font-medium flex items-center">
                                        <StickyNote className="mr-2 h-4 w-4" />
                                        Booking Notes
                                    </Label>
                                    <Textarea
                                        id="bookingNotes"
                                        value={notesInput}
                                        onChange={(e) => setNotesInput(e.target.value)}
                                        className="mt-1"
                                        placeholder="Add any relevant notes for this booking (optional)"
                                        rows={3}
                                    />
                                </div>
                            </form>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" form="new-booking-form" disabled={isSubmitting || isLoadingBookedSlots || isLoadingPreferences} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold py-3">
                                {isSubmitting || isLoadingBookedSlots || isLoadingPreferences ? (
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  ) : "Submit Booking"}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </main>
            <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">
                 © {new Date().getFullYear()} Appointa. All rights reserved.
            </footer>
        </div>
    );
}
