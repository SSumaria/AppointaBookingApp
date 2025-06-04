
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar as CalendarIconLucideShadcn } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, addMinutes, parse } from "date-fns";
import { Calendar as CalendarIcon, Clock, User, StickyNote } from "lucide-react";
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

import { ref, set, get, query as rtQuery, orderByChild, equalTo, push, startAt, endAt } from "firebase/database";
import { db } from '@/lib/firebaseConfig';

interface Note {
  id: string;
  text: string;
  timestamp: number;
}

interface Booking {
  id: string;
  AppointmentID: string;
  ClientID: string;
  ServiceProcedure: string;
  AppointmentDate: string;
  AppointmentStartTime: string;
  AppointmentEndTime: string;
  BookingStatus?: string;
  BookedByUserID?: string;
  Notes?: Note[];
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
    ClientContact?: string;
}

interface ClientSuggestion extends ClientData {
  id: string; // Firebase key
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

// Helper to generate a simple unique ID for notes
const generateNoteId = () => {
  return Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
};

export default function NewBookingPage() {
    const [clientName, setClientName] = useState('');
    const [clientContact, setClientContact] = useState('');
    const [serviceProcedure, setServiceProcedure] = useState('');
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [notesInput, setNotesInput] = useState('');
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [bookedTimeSlotsForDate, setBookedTimeSlotsForDate] = useState<Set<string>>(new Set());
    const [isLoadingBookedSlots, setIsLoadingBookedSlots] = useState(false);

    const { currentUser, loading: authLoading } = useAuth();
    const router = useRouter();

    // Autocomplete state
    const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedClientFirebaseKey, setSelectedClientFirebaseKey] = useState<string | null>(null);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

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
        setSelectedClientFirebaseKey(null); // Clear selected client if name is manually changed
        // If name is cleared, also clear contact that might have been auto-filled
        if (query.trim() === '') {
          setClientContact('');
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
                    setSuggestions(fetchedSuggestions.slice(0, 5)); // Limit suggestions
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
        setClientContact(suggestion.ClientContact || '');
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

        if (!currentUser) {
            toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
            setIsSubmitting(false);
            router.push('/login');
            return;
        }

        if (!clientName.trim() || !serviceProcedure || !date || !startTime || !endTime) {
            toast({ title: "Error", description: "Client Name, Service, Date, Start Time, and End Time are required.", variant: "destructive" });
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
            toast({ title: "Booking Conflict", description: "The selected time range overlaps with an existing booking.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }

        if (!db) {
            toast({ title: "Error", description: "Database not initialized.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }

        let clientIdToUse: string | null = selectedClientFirebaseKey;
        let finalClientName = clientName.trim(); // Name from form input by default
        let finalClientContact = clientContact.trim(); // Contact from form input by default

        const finalNotes: Note[] = [];
        if (notesInput.trim()) {
          finalNotes.push({
            id: generateNoteId(),
            text: notesInput.trim(),
            timestamp: Date.now(),
          });
        }

        try {
            if (!clientIdToUse) { // If no client was selected from autocomplete
                const userClientsRefPath = `Clients/${currentUser.uid}`;
                const clientsDbRef = ref(db, userClientsRefPath);
                // Query more efficiently by name if possible, or fetch all and filter client-side for smaller datasets
                const clientsSnapshot = await get(rtQuery(clientsDbRef, orderByChild('ClientName')));

                const inputNameLower = finalClientName.toLowerCase();
                const inputContactLower = finalClientContact.toLowerCase();
                let foundExisting = false;

                if (clientsSnapshot.exists()) {
                    clientsSnapshot.forEach((childSnapshot) => {
                        const clientData = childSnapshot.val() as ClientData;
                        const dbNameLower = (clientData.ClientName || "").trim().toLowerCase();
                        
                        if (inputContactLower) { // If contact info is provided in the form, match on name AND contact
                            const dbContactLower = (clientData.ClientContact || "").trim().toLowerCase();
                            if (dbNameLower === inputNameLower && dbContactLower === inputContactLower) {
                                clientIdToUse = childSnapshot.key;
                                finalClientName = clientData.ClientName; // Use existing name (preserves casing)
                                finalClientContact = clientData.ClientContact || ''; // Use existing contact
                                setClientContact(finalClientContact); // Update form state
                                foundExisting = true;
                                return true; // Exit forEach
                            }
                        } else { // If no contact info is provided in the form, match by name ONLY
                            if (dbNameLower === inputNameLower) {
                                clientIdToUse = childSnapshot.key;
                                finalClientName = clientData.ClientName; // Use existing name
                                finalClientContact = clientData.ClientContact || ''; // Use existing contact
                                setClientContact(finalClientContact); // Update form state if found
                                foundExisting = true;
                                return true; // Exit forEach
                            }
                        }
                    });
                }

                if (!foundExisting) { // Create new client
                    const newClientRef = push(clientsDbRef);
                    clientIdToUse = newClientRef.key as string;
                    const now = new Date();
                    await set(newClientRef, {
                        ClientID: clientIdToUse, // Store the Firebase key as ClientID
                        ClientName: finalClientName, // Name from form
                        ClientContact: finalClientContact, // Contact from form
                        CreateDate: format(now, "yyyy-MM-dd"),
                        CreateTime: format(now, "HH:mm"),
                        CreatedByUserID: currentUser.uid
                    });
                }
            } else { // Client was selected from autocomplete, ensure finalClientName and finalClientContact are from the selection
                const selectedClientRef = ref(db, `Clients/${currentUser.uid}/${clientIdToUse}`);
                const clientSnapshot = await get(selectedClientRef);
                if(clientSnapshot.exists()){
                    const clientData = clientSnapshot.val() as ClientData;
                    finalClientName = clientData.ClientName;
                    finalClientContact = clientData.ClientContact || '';
                }
            }


            const userAppointmentsRefPath = `Appointments/${currentUser.uid}`;
            const appointmentsRefForUser = ref(db, userAppointmentsRefPath);
            const newAppointmentRef = push(appointmentsRefForUser);
            const appointmentId = newAppointmentRef.key;

            await set(newAppointmentRef, {
                AppointmentID: appointmentId,
                ClientID: clientIdToUse, // This will be either existing or new client's Firebase key
                ServiceProcedure: serviceProcedure,
                AppointmentDate: selectedFormattedDate,
                AppointmentStartTime: startTime,
                AppointmentEndTime: endTime,
                BookingStatus: "Booked",
                Notes: finalNotes,
                BookedByUserID: currentUser.uid
            });

            toast({ title: "Success", description: `Booking Confirmed for ${finalClientName}!` });
            if(date) fetchBookedSlots(date);

            // Reset form fields
            setClientName('');
            setClientContact('');
            setServiceProcedure('');
            setNotesInput('');
            setStartTime('');
            setEndTime('');
            // setDate(new Date()); // Optional: reset date or keep it
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
                        <div className="relative" ref={suggestionsRef}>
                            <Label htmlFor="clientName" className="font-medium">Client Name *</Label>
                            <Input
                                type="text"
                                id="clientName"
                                value={clientName}
                                onChange={handleClientNameChange}
                                onFocus={() => clientName.trim().length > 0 && suggestions.length > 0 && setShowSuggestions(true)}
                                required
                                autoComplete="off"
                                className="mt-1"
                                placeholder="Start typing client's name..."
                            />
                            {showSuggestions && suggestions.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {suggestions.map((suggestion) => (
                                        <div
                                            key={suggestion.id}
                                            className="px-3 py-2 hover:bg-accent hover:text-accent-foreground cursor-pointer"
                                            onClick={() => handleSuggestionClick(suggestion)}
                                        >
                                            {suggestion.ClientName} {suggestion.ClientContact && `(${suggestion.ClientContact})`}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <Label htmlFor="clientContact" className="font-medium">Client Contact (Phone or Email)</Label>
                            <Input
                                type="text"
                                id="clientContact"
                                value={clientContact}
                                onChange={(e) => setClientContact(e.target.value)}
                                className="mt-1"
                                placeholder="Client's phone or email"
                                // If a client is selected via autocomplete, this might be disabled or readonly
                                // For now, allow editing. It gets re-evaluated on submit.
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
                                Checking available slots for {date ? format(date, "PPP") : 'selected date'}...
                            </div>
                        )}
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
                                placeholder="Add any relevant notes for this booking..."
                                rows={3}
                            />
                        </div>
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
