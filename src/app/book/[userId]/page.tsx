
"use client";

console.log("--- PublicBookingPage (/book/[userId]/page.tsx) --- MODULE SCRIPT EXECUTING (TOP LEVEL)");

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Calendar as CalendarIconLucideShadcn } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, addMinutes, parse, getHours, getMinutes, getDay, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Clock, AlertTriangle, Loader2, User } from "lucide-react";
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
  googleEventId?: string;
}

const daysOfWeekConst = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
type DayOfWeek = typeof daysOfWeekConst[number];

interface DaySetting {
  startTime: string;
  endTime: string;
  isUnavailable: boolean;
}
export type WorkingHours = Record<DayOfWeek, DaySetting>;

const initialWorkingHoursDefaults: WorkingHours = {
  monday:    { startTime: "09:00", endTime: "17:00", isUnavailable: false },
  tuesday:   { startTime: "09:00", endTime: "17:00", isUnavailable: false },
  wednesday: { startTime: "09:00", endTime: "17:00", isUnavailable: false },
  thursday:  { startTime: "09:00", endTime: "17:00", isUnavailable: false },
  friday:    { startTime: "09:00", endTime: "17:00", isUnavailable: false },
  saturday:  { startTime: "09:00", endTime: "17:00", isUnavailable: true },
  sunday:    { startTime: "09:00", endTime: "17:00", isUnavailable: true },
};

const generateTimeSlots = () => {
  const slots = [];
  let currentTime = new Date();
  currentTime.setHours(0, 0, 0, 0); 
  const dayEndLimit = new Date();
  dayEndLimit.setHours(23, 59, 0, 0); 
  while (currentTime <= dayEndLimit) {
    slots.push(format(currentTime, "HH:mm"));
    currentTime = addMinutes(currentTime, 30);
  }
  return slots;
};
const allDayTimeSlots = generateTimeSlots();

interface FoundClientData {
  ClientName: string;
  ClientContact: string; // This is phone
  firebaseKey: string; // The actual Firebase key of the client
  ClientEmail: string;
}


export default function PublicBookingPage() {
  console.log("--- PublicBookingPage (/book/[userId]/page.tsx) --- COMPONENT RENDERING ---");
  const params = useParams();
  const serviceProviderUserId = params.userId as string;
  console.log(`PublicBookingPage: Service Provider User ID from URL params: '${serviceProviderUserId}'`);
  
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState(''); 
  const [serviceProcedure, setServiceProcedure] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [serviceProviderExists, setServiceProviderExists] = useState<boolean | null>(null);
  const [serviceProviderName, setServiceProviderName] = useState('');
  const [serviceProviderEmail, setServiceProviderEmail] = useState('');
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  const [bookedTimeSlotsForDate, setBookedTimeSlotsForDate] = useState<Set<string>>(new Set());
  const [isLoadingBookedSlots, setIsLoadingBookedSlots] = useState(false);

  const [workingHoursPreferences, setWorkingHoursPreferences] = useState<WorkingHours | null>(null);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);

  const [isLookingUpClient, setIsLookingUpClient] = useState(false);
  const [foundExistingClientData, setFoundExistingClientData] = useState<FoundClientData | null>(null);
  const [clientLookupMessage, setClientLookupMessage] = useState<string | null>(null);
  const emailDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  const fetchUserPreferences = useCallback(async (userId: string) => {
    if (!db || !userId) {
        setWorkingHoursPreferences(initialWorkingHoursDefaults);
        setIsLoadingPreferences(false);
        return;
    }
    setIsLoadingPreferences(true);
    try {
        const preferencesRef = ref(db, `UserPreferences/${userId}/workingHours`);
        const snapshot = await get(preferencesRef);
        if (snapshot.exists()) {
            const loadedPrefs = snapshot.val() as WorkingHours;
            let isValid = true;
            daysOfWeekConst.forEach(day => {
                if (!loadedPrefs[day] || 
                    typeof loadedPrefs[day].startTime !== 'string' ||
                    typeof loadedPrefs[day].endTime !== 'string' ||
                    typeof loadedPrefs[day].isUnavailable !== 'boolean'
                ) {
                    isValid = false;
                }
            });
            if(isValid) {
                setWorkingHoursPreferences(loadedPrefs);
            } else {
                console.warn(`Invalid preferences structure for provider ${userId}, using defaults.`);
                setWorkingHoursPreferences(initialWorkingHoursDefaults); 
            }
        } else {
            console.log(`No preferences found for provider ${userId}, using defaults.`);
            setWorkingHoursPreferences(initialWorkingHoursDefaults);
        }
    } catch (error: any) {
        console.error("Error fetching user preferences for public booking:", error);
        let description = error.message || "Could not load provider's availability settings.";
        if (error.message && error.message.toLowerCase().includes("permission denied")) {
            description = "Permission denied fetching provider availability. The provider's settings might not be publicly accessible. Please ensure Firebase rules allow reading 'UserPreferences/$uid/workingHours'.";
        }
        toast({ title: "Error", description: description, variant: "destructive", duration: 10000 });
        setWorkingHoursPreferences(initialWorkingHoursDefaults);
    } finally {
        setIsLoadingPreferences(false);
    }
  }, [toast]);


  const checkServiceProvider = useCallback(async () => {
    console.log(`PublicBookingPage: checkServiceProvider called for User ID: '${serviceProviderUserId}'.`);
    if (!serviceProviderUserId || !db) {
      setServiceProviderExists(false);
      setInitialCheckDone(true);
      if (!db) console.error("PublicBookingPage: CRITICAL - Firebase DB is not initialized.");
      return;
    }

    try {
      const userRef = ref(db, `Users/${serviceProviderUserId}`);
      const userSnapshot = await get(userRef);

      if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          setServiceProviderName(userData.name || '');
          setServiceProviderEmail(userData.email || ''); // Store the email
          setServiceProviderExists(true);
      } else {
        setServiceProviderExists(false);
      }
      
      console.log(`PublicBookingPage: Provider ${userSnapshot.exists() ? 'VERIFIED' : 'NOT VERIFIED/NEW'}.`);
    } catch (error: any) {
      console.error(`PublicBookingPage: Error during database check for ID '${serviceProviderUserId}':`, error);
      toast({ title: "Error Verifying Provider", description: `Could not verify provider status. ${error.message}`, variant: "destructive" });
      setServiceProviderExists(false); 
    } finally {
      setInitialCheckDone(true);
    }
  }, [serviceProviderUserId, toast]); 

  useEffect(() => {
    if (serviceProviderUserId) { 
        checkServiceProvider();
    } else {
        setServiceProviderExists(false); 
        setInitialCheckDone(true); 
        setIsLoadingPreferences(false);
    }
  }, [serviceProviderUserId, checkServiceProvider]);

  
  useEffect(() => {
    if (serviceProviderUserId && initialCheckDone && serviceProviderExists === true) { 
        fetchUserPreferences(serviceProviderUserId);
    } else if (initialCheckDone && serviceProviderExists !== true) {
        // Don't fetch if provider doesn't exist or check is not done
        setWorkingHoursPreferences(initialWorkingHoursDefaults);
        setIsLoadingPreferences(false);
    }
  }, [serviceProviderUserId, initialCheckDone, serviceProviderExists, fetchUserPreferences]);


  const fetchBookedSlots = useCallback(async (selectedDate: Date) => {
    if (!serviceProviderUserId || !selectedDate) {
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
                console.error("PublicBookingPage: Error parsing booking times from DB:", booking, parseError);
              }
          }
        });
      }
      setBookedTimeSlotsForDate(newBookedSlots);
    } catch (error: any) {
      console.error("PublicBookingPage: Error fetching booked slots:", error);
      toast({ title: "Error loading schedule", description: `Could not fetch existing bookings. ${error.message}`, variant: "destructive" });
      setBookedTimeSlotsForDate(new Set());
    } finally {
      setIsLoadingBookedSlots(false);
    }
  }, [serviceProviderUserId, toast]);

  useEffect(() => {
    if (date && serviceProviderUserId && initialCheckDone && serviceProviderExists === true) { 
      fetchBookedSlots(date);
    }
  }, [date, serviceProviderUserId, initialCheckDone, serviceProviderExists, fetchBookedSlots]);

  const displayableTimeSlots = useMemo(() => {
    if (!date || isLoadingPreferences || !workingHoursPreferences) return [];
    const dayName = daysOfWeekConst[getDay(date)] as DayOfWeek;
    const dayPref = workingHoursPreferences[dayName];
    if (dayPref.isUnavailable) return [];
    const prefStartTimeDt = parse(dayPref.startTime, "HH:mm", date);
    const prefEndTimeDt = parse(dayPref.endTime, "HH:mm", date);
    return allDayTimeSlots.filter(slot => {
      const currentSlotDateTime = parse(slot, "HH:mm", date);
      const bookingEndDateTime = addMinutes(currentSlotDateTime, 60);
      return currentSlotDateTime >= prefStartTimeDt && bookingEndDateTime <= prefEndTimeDt;
    });
  }, [date, workingHoursPreferences, isLoadingPreferences]);


  const fetchExistingClientByEmail = useCallback(async (emailToSearch: string) => {
    if (!serviceProviderUserId || !emailToSearch.trim() || !db) {
        setFoundExistingClientData(null);
        setClientLookupMessage(null);
        return;
    }
    setIsLookingUpClient(true);
    setClientLookupMessage("Checking for existing record...");

    try {
        const clientsRefPath = `Clients/${serviceProviderUserId}`;
        const clientsRef = ref(db, clientsRefPath);
        const clientQuery = rtQuery(clientsRef, orderByChild('ClientEmail'), equalTo(emailToSearch.trim().toLowerCase()));
        
        const snapshot = await get(clientQuery);
        if (snapshot.exists()) {
            let clientFound: FoundClientData | null = null;
            snapshot.forEach(childSnapshot => { // Should typically be one, but loop to grab first
                const data = childSnapshot.val();
                clientFound = {
                    firebaseKey: childSnapshot.key as string,
                    ClientName: data.ClientName,
                    ClientContact: data.ClientContact,
                    ClientEmail: data.ClientEmail // Store original case email if needed, or store as searched
                };
                return true; // stop iterating after first match
            });

            if (clientFound) {
                setClientName(clientFound.ClientName);
                setClientPhone(clientFound.ClientContact || '');
                setFoundExistingClientData(clientFound);
                setClientLookupMessage(`Welcome back, ${clientFound.ClientName}! Your details have been pre-filled.`);
            } else { // Should not happen if snapshot.exists() is true and forEach ran
                setFoundExistingClientData(null);
                setClientLookupMessage("No existing record found. Please complete your details.");
            }
        } else {
            setFoundExistingClientData(null);
            if (clientName && foundExistingClientData) { // If previously found, but now email changed to non-existing
                setClientName(''); setClientPhone('');
            }
            setClientLookupMessage("No existing record found. Please complete your details.");
        }
    } catch (error) {
        console.error("Error looking up client by email:", error);
        setFoundExistingClientData(null);
        setClientLookupMessage("Error checking email. Please try again.");
        toast({ title: "Lookup Error", description: "Could not check for existing client records.", variant: "destructive"});
    } finally {
        setIsLookingUpClient(false);
    }
  }, [serviceProviderUserId, toast, clientName, foundExistingClientData]);


  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setClientEmail(newEmail);
    setFoundExistingClientData(null); // Reset if email changes
    setClientLookupMessage(null);
    if (!newEmail.trim()) { // Clear prefill if email is cleared
        setClientName('');
        setClientPhone('');
    }

    if (emailDebounceTimeoutRef.current) {
        clearTimeout(emailDebounceTimeoutRef.current);
    }

    if (newEmail.trim().length > 2 && newEmail.includes('@')) { // Basic validation before search
        emailDebounceTimeoutRef.current = setTimeout(() => {
            fetchExistingClientByEmail(newEmail);
        }, 750); // Debounce for 750ms
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!serviceProviderUserId) {
        toast({ title: "Error", description: "Service provider ID missing.", variant: "destructive" });
        setIsSubmitting(false); return;
    }
    if (!clientName || !serviceProcedure || !date || !startTime || !clientEmail || !clientPhone) {
        toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
        setIsSubmitting(false); return;
    }

    const selectedFormattedDate = format(date, "yyyy-MM-dd");
    const baseDateForSubmitParse = new Date(selectedFormattedDate + "T00:00:00");
    const startDateTime = parse(startTime, 'HH:mm', baseDateForSubmitParse);
    const endDateTime = addMinutes(startDateTime, 60); 
    const calculatedEndTime = format(endDateTime, "HH:mm");

    const currentPrefs = workingHoursPreferences || initialWorkingHoursDefaults;
    const dayName = daysOfWeekConst[getDay(date)] as DayOfWeek;
    const dayPref = currentPrefs[dayName];

    if (dayPref.isUnavailable) {
        toast({ title: "Booking Error", description: "The selected day is marked as unavailable by the provider.", variant: "destructive" });
        setIsSubmitting(false); return;
    }
    const prefStartTimeDt = parse(dayPref.startTime, 'HH:mm', baseDateForSubmitParse);
    const prefEndTimeDt = parse(dayPref.endTime, 'HH:mm', baseDateForSubmitParse);

    if (startDateTime < prefStartTimeDt) {
        toast({ title: "Booking Error", description: `Booking cannot start before provider's opening time of ${dayPref.startTime}.`, variant: "destructive" });
        setIsSubmitting(false); return;
    }
    if (endDateTime > prefEndTimeDt) {
        toast({ title: "Booking Error", description: `A 1-hour booking from ${startTime} would end after provider's closing time of ${dayPref.endTime}.`, variant: "destructive" });
        setIsSubmitting(false); return;
    }

    let tempSlot = startDateTime;
    let hasOverlap = false;
    while(tempSlot < endDateTime) { 
        if(bookedTimeSlotsForDate.has(format(tempSlot, "HH:mm"))) {
            hasOverlap = true; break;
        }
        tempSlot = addMinutes(tempSlot, 30);
    }
    if(hasOverlap) {
        toast({ title: "Booking Conflict", description: "The selected 1-hour time slot is no longer available.", variant: "destructive" });
        setIsSubmitting(false); if (date) fetchBookedSlots(date); return;
    }

    if (!db) {
        toast({ title: "Error", description: "Database not initialized.", variant: "destructive" });
        setIsSubmitting(false); return;
    }

    let clientIDToUse: string;
    const now = new Date();

    try {
        if (foundExistingClientData) {
            clientIDToUse = foundExistingClientData.firebaseKey;
        } else {
            // Create new client
            const providerClientsRefPath = `Clients/${serviceProviderUserId}`;
            const newClientRef = push(ref(db, providerClientsRefPath));
            clientIDToUse = newClientRef.key as string;
            const newClientData = { 
                ClientID: clientIDToUse, // Store Firebase key as ClientID for consistency
                ClientName: clientName.trim(), 
                ClientEmail: clientEmail.trim().toLowerCase(), // Store email in lowercase for consistency
                ClientContact: clientPhone.trim(), 
                CreateDate: format(now, "yyyy-MM-dd"), 
                CreateTime: format(now, "HH:mm"), 
                CreatedByUserID: serviceProviderUserId // Mark who this client "belongs" to
            };
            await set(newClientRef, newClientData);
        }

        const appointmentDataToSave = { 
            AppointmentID: "", 
            ClientID: clientIDToUse, 
            ServiceProcedure: serviceProcedure, 
            AppointmentDate: selectedFormattedDate, 
            AppointmentStartTime: startTime, 
            AppointmentEndTime: calculatedEndTime, 
            BookingStatus: "Booked", 
            BookedByUserID: serviceProviderUserId, // Mark who this appt "belongs" to
            _ClientNameSnapshot: clientName.trim(),
            _ClientEmailSnapshot: clientEmail.trim().toLowerCase(),
        };

        const providerAppointmentsRefPath = `Appointments/${serviceProviderUserId}`;
        const newAppointmentRef = push(ref(db, providerAppointmentsRefPath));
        appointmentDataToSave.AppointmentID = newAppointmentRef.key as string;
        await set(newAppointmentRef, appointmentDataToSave);
        
        // Send email notifications
        if (clientEmail && serviceProviderEmail && date) {
            try {
                const emailPayload = {
                    action: 'sendConfirmation',
                    providerEmail: serviceProviderEmail,
                    clientName: clientName,
                    clientEmail: clientEmail,
                    appointmentDate: format(date, "PPP"),
                    appointmentTime: `${startTime} - ${calculatedEndTime}`,
                    service: serviceProcedure,
                };
                await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(emailPayload),
                });
                toast({ title: "Booking Confirmed!", description: `Your 1-hour appointment for ${serviceProcedure} has been booked. A confirmation email has been sent.` });
            } catch (emailError) {
                console.error("Failed to call send-email API for confirmation:", emailError);
                toast({ title: "Booking Confirmed (Email Failed)", description: "Your appointment is booked, but the confirmation email could not be sent.", variant: "destructive" });
            }
        } else {
            toast({ title: "Booking Confirmed!", description: `Your 1-hour appointment for ${serviceProcedure} has been booked.` });
        }
        
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Sync to Google Calendar (fire-and-forget)
        fetch('/api/google-calendar-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            bookingId: appointmentDataToSave.AppointmentID,
            userId: serviceProviderUserId,
            timeZone: timeZone,
          })
        }).then(res => res.json()).then(data => {
          if (data.success) {
            console.log("Successfully synced new public booking to Google Calendar.");
          } else {
            console.warn("Failed to sync new public booking to Google Calendar:", data.message);
          }
        }).catch(err => {
          console.error("Error calling calendar sync API:", err);
        });

        if(date) fetchBookedSlots(date); 
        
        setClientName(''); 
        setClientEmail(''); 
        setClientPhone(''); 
        setServiceProcedure(''); 
        setStartTime('');
        setFoundExistingClientData(null);
        setClientLookupMessage(null);

    } catch (error: any) {
        handleAuthErrorSubmit(error, "An unexpected error occurred during booking.");
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleAuthErrorSubmit = (error: any, defaultMessage: string) => {
    console.error("Error during public booking submission:", error);
    let detailedMessage = defaultMessage;
    if (error.code === 'PERMISSION_DENIED') {
        detailedMessage = `Database permission denied. Please check Firebase rules.`;
    } else if (error.message) {
        detailedMessage = error.message;
    }
    toast({ title: "Booking Error", description: detailedMessage, variant: "destructive", duration: 10000 });
  };


  if (!serviceProviderUserId) { 
     return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-md shadow-xl p-6 text-center">
                <CardHeader><CardTitle className="text-2xl font-bold text-destructive mb-4">Invalid Link</CardTitle></CardHeader>
                <CardContent><CardDescription>Booking link is incomplete or invalid.</CardDescription></CardContent>
            </Card>
            <footer className="fixed bottom-0 bg-transparent py-4 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} Appointa.</footer>
        </div>
    );
  }

  if (!initialCheckDone || isLoadingPreferences) { 
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted/40 p-4">
            <Loader2 className="animate-spin mx-auto h-12 w-12 text-primary" />
            <p className="mt-4 text-muted-foreground">
              {!initialCheckDone ? "Verifying booking link..." : "Loading provider availability..."}
            </p>
            <footer className="fixed bottom-0 bg-transparent py-4 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} Appointa.</footer>
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
                        <AlertTitle>Notice: Unrecognized Provider Link</AlertTitle>
                        <AlertDescription>
                            This booking link may be for a new provider. Bookings will use default availability until configured.
                        </AlertDescription>
                    </Alert>
                )}
                <Card className="shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold text-center text-primary">
                            New Appointment Booking {serviceProviderName && `for ${serviceProviderName}`}
                        </CardTitle>
                        <CardDescription className="text-center">Fill in your details for a 1-hour appointment.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6 p-2 sm:p-0">
                            <div>
                                <Label htmlFor="clientEmail" className="font-medium">Your Email *</Label>
                                <Input type="email" id="clientEmail" value={clientEmail} onChange={handleEmailChange} required className="mt-1" placeholder="Enter your email to check for existing details" />
                                {isLookingUpClient && <p className="text-xs text-muted-foreground mt-1 flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1" />Checking...</p>}
                                {clientLookupMessage && !isLookingUpClient && (
                                    <p className={cn("text-xs mt-1", foundExistingClientData ? "text-green-600" : "text-muted-foreground")}>
                                        {clientLookupMessage}
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="clientName" className="font-medium">Your Name *</Label>
                                <Input type="text" id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} required className="mt-1" placeholder="Enter your full name" readOnly={!!foundExistingClientData} />
                            </div>
                            <div>
                                <Label htmlFor="clientPhone" className="font-medium">Your Phone Number *</Label>
                                <Input type="tel" id="clientPhone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} required className="mt-1" placeholder="Enter your phone number" readOnly={!!foundExistingClientData}/>
                            </div>
                            <div>
                                <Label htmlFor="serviceProcedure" className="font-medium">Service/Procedure Requested *</Label>
                                <Textarea id="serviceProcedure" value={serviceProcedure} onChange={(e) => setServiceProcedure(e.target.value)} required className="mt-1" placeholder="Describe the service you need" />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-6">
                                <div className="flex-1">
                                    <Label htmlFor="date" className="font-medium">Appointment Date *</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal mt-1", !date && "text-muted-foreground")} disabled={isLoadingPreferences}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {date ? format(date, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <CalendarIconLucideShadcn
                                                mode="single"
                                                selected={date}
                                                onSelect={(selectedDay) => { setDate(selectedDay); setStartTime(''); }}
                                                disabled={(d) => {
                                                    if (d < new Date(new Date().setHours(0,0,0,0))) return true;
                                                    if (isLoadingPreferences || !workingHoursPreferences) return false; 
                                                    const dayName = daysOfWeekConst[getDay(d)] as DayOfWeek;
                                                    return workingHoursPreferences[dayName]?.isUnavailable || false;
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="flex-1">
                                    <Label htmlFor="startTime" className="font-medium">Start Time *</Label>
                                    <Select value={startTime} onValueChange={setStartTime} disabled={isLoadingBookedSlots || isLoadingPreferences || !date || displayableTimeSlots.length === 0}>
                                        <SelectTrigger className="w-full mt-1">
                                            <SelectValue placeholder={isLoadingBookedSlots || isLoadingPreferences ? "Loading..." : (displayableTimeSlots.length === 0 && date && !isLoadingPreferences ? "No slots" : "Select start time")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                             {(isLoadingBookedSlots || isLoadingPreferences) && <SelectItem value="loading" disabled>Loading slots...</SelectItem>}
                                             {!isLoadingBookedSlots && !isLoadingPreferences && displayableTimeSlots.length === 0 && date && (
                                                <SelectItem value="no-slots" disabled>No available slots</SelectItem>
                                             )}
                                             {!isLoadingBookedSlots && !isLoadingPreferences && displayableTimeSlots.map(slot => {
                                                let itemIsDisabled = false;
                                                let itemLabelSuffix = "";
                                                if (date) {
                                                    const currentSlotDateTime = parse(slot, "HH:mm", date);
                                                    const currentSlotEndDateTime = addMinutes(currentSlotDateTime, 60);
                                                    let tempCheckTime = currentSlotDateTime;
                                                    while(tempCheckTime < currentSlotEndDateTime){
                                                        if(bookedTimeSlotsForDate.has(format(tempCheckTime, "HH:mm"))){
                                                            itemIsDisabled = true;
                                                            itemLabelSuffix = "(Unavailable)";
                                                            break;
                                                        }
                                                        tempCheckTime = addMinutes(tempCheckTime, 30);
                                                    }
                                                } else {
                                                    itemIsDisabled = true; 
                                                }
                                                return (
                                                    <SelectItem key={`start-${slot}`} value={slot} disabled={itemIsDisabled}>
                                                        {slot} {itemLabelSuffix}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {(isLoadingBookedSlots || isLoadingPreferences) && date && ( 
                                <div className="flex items-center text-sm text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {isLoadingPreferences ? "Loading availability..." : `Checking slots for ${format(date, "PPP")}...`}
                                </div>
                            )}
                            <Button type="submit" disabled={isSubmitting || isLoadingBookedSlots || isLoadingPreferences || isLookingUpClient} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold py-3 mt-8">
                                {isSubmitting || isLoadingBookedSlots || isLoadingPreferences || isLookingUpClient ? (
                                    <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                                ) : "Submit Booking"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </main>
        <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">
            © {new Date().getFullYear()} Appointa. All rights reserved.
        </footer>
    </div>
  );
}
