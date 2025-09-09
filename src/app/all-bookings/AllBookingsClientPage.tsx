
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { DateRange, DayContentProps } from "react-day-picker";
import { Calendar as CalendarIconLucide, ListFilter, XCircle, Edit, PlusCircle, CalendarDays, ChevronLeft, ChevronRight, Edit3, Mic, Save, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parse, parseISO, isSameDay, addDays, subDays, startOfWeek, endOfWeek, eachDayOfInterval, addMinutes, getHours, getMinutes } from "date-fns";
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
import { useRouter, useSearchParams } from 'next/navigation';
import { ref, get, query as rtQuery, orderByChild, equalTo, update } from "firebase/database";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WeeklyCalendarView from '@/components/calendar/WeeklyCalendarView';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { transcribeAudio } from '@/ai/flows/transcribe-audio-flow';


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
  ClientEmail?: string;
  ClientContact?: string;
  ServiceProcedure: string;
  AppointmentDate: string; // yyyy-MM-dd
  AppointmentStartTime: string;
  AppointmentEndTime: string;
  BookingStatus?: string;
  Notes?: Note[];
  BookedByUserID?: string;
  googleEventId?: string;
}

interface Client {
    id: string;
    ClientName: string;
    ClientEmail?: string;
    ClientContact?: string;
}

interface EditBookingFormState {
  serviceProcedure: string;
  appointmentDate: Date | undefined;
  appointmentStartTime: string;
  appointmentEndTime: string;
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


const generateNoteId = () => {
  return Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
};


export default function AllBookingsClientPage() {
  const [allFetchedBookings, setAllFetchedBookings] = useState<Booking[]>([]);
  const [bookingsForDisplay, setBookingsForDisplay] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>(undefined);
  const { toast } = useToast();
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [editingBookingNotes, setEditingBookingNotes] = useState<Booking | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [activeNotesTab, setActiveNotesTab] = useState("draft");

  
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
  const [editFormState, setEditFormState] = useState<EditBookingFormState | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editBookedTimeSlotsForDate, setEditBookedTimeSlotsForDate] = useState<Set<string>>(new Set());
  const [isLoadingEditBookedSlots, setIsLoadingEditBookedSlots] = useState(false);

  const [calendarOverviewMonth, setCalendarOverviewMonth] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<"month" | "week">("month");
  const [weekViewDate, setWeekViewDate] = useState<Date>(new Date());
  
  // States for voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);
  
  useEffect(() => {
      // Check for mic permission on component mount silently
      navigator.mediaDevices.enumerateDevices().then(devices => {
          const hasMic = devices.some(device => device.kind === 'audioinput');
          if (hasMic) {
              navigator.permissions.query({ name: 'microphone' as PermissionName }).then(permissionStatus => {
                  if (permissionStatus.state === 'granted') {
                      setHasMicPermission(true);
                  }
                  permissionStatus.onchange = () => {
                      setHasMicPermission(permissionStatus.state === 'granted');
                  };
              });
          }
      });
  }, []);

  const fetchAndSetAllBookings = useCallback(async () => {
    if (!currentUser?.uid) return;

    setIsLoading(true);
    try {
        const userClientsRefPath = `Clients/${currentUser.uid}`;
        const clientsRef = ref(db, userClientsRefPath);
        const clientsSnapshot = await get(clientsRef);
        const clientsMap = new Map<string, Client>();
        if (clientsSnapshot.exists()) {
            clientsSnapshot.forEach(child => {
                const clientData = child.val();
                clientsMap.set(child.key as string, {
                    id: child.key as string,
                    ClientName: clientData.ClientName,
                    ClientEmail: clientData.ClientEmail,
                    ClientContact: clientData.ClientContact,
                });
            });
        }

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
                
                const clientDetails = clientsMap.get(data.ClientID);

                fetchedBookings.push({
                    id: childSnapshot.key as string,
                    ...data,
                    ClientName: clientDetails?.ClientName || "Unknown Client",
                    ClientEmail: clientDetails?.ClientEmail,
                    ClientContact: clientDetails?.ClientContact,
                    Notes: processedNotes,
                });
            });
        }

        fetchedBookings.sort((a, b) => {
            const dateComparison = b.AppointmentDate.localeCompare(a.AppointmentDate);
            if (dateComparison !== 0) return dateComparison;
            return b.AppointmentStartTime.localeCompare(a.AppointmentStartTime);
        });

        setAllFetchedBookings(fetchedBookings);

    } catch (error: any) {
        console.error("Error fetching bookings:", error);
        toast({ title: "Error", description: "Failed to fetch bookings.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }, [currentUser?.uid, toast]);


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
    setBookingsForDisplay(filtered);
    setIsLoading(false);
  }, [allFetchedBookings, filterDateRange]);

  useEffect(() => {
    const bookingToOpenId = searchParams.get('openBooking');
    if (bookingToOpenId && allFetchedBookings.length > 0) {
      const booking = allFetchedBookings.find(b => b.id === bookingToOpenId);
      if (booking) {
        handleOpenNotesDialog(booking);
        const noteToEditId = searchParams.get('editNote');
        if (noteToEditId) {
          const noteToEdit = booking.Notes?.find(n => n.id === noteToEditId);
          if (noteToEdit) {
            handleEditNoteClick(noteToEdit);
          }
        }
        // Clean the URL params after opening
        router.replace('/all-bookings', { scroll: false });
      }
    }
  }, [searchParams, allFetchedBookings, router]);


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

  const handleCancelBooking = async (booking: Booking) => {
    if (!currentUser?.uid || !currentUser.email) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    try {
      const bookingRefPath = `Appointments/${currentUser.uid}/${booking.id}`;
      await update(ref(db, bookingRefPath), { BookingStatus: "Cancelled" });
      
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Sync deletion to Google Calendar
      fetch('/api/google-calendar-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          bookingId: booking.id,
          userId: currentUser.uid,
          timeZone: timeZone,
        })
      }).then(res => res.json()).then(data => {
        if(data.success) console.log(`Successfully synced cancellation for booking ${booking.id} to Google Calendar.`);
        else console.warn(`Failed to sync cancellation for booking ${booking.id}:`, data.message);
      }).catch(err => console.error("Error calling calendar sync for cancellation:", err));


      if (booking.ClientEmail) {
        try {
            const emailPayload = {
                action: 'sendCancellation',
                providerName: currentUser.displayName || 'Your Provider',
                providerEmail: currentUser.email,
                clientName: booking.ClientName || 'Valued Client',
                clientEmail: booking.ClientEmail,
                appointmentDate: format(parseISO(booking.AppointmentDate), "PPP"),
                appointmentTime: `${booking.AppointmentStartTime} - ${booking.AppointmentEndTime}`,
                service: booking.ServiceProcedure,
            };
            await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emailPayload),
            });
            toast({
                title: "Booking Cancelled & Notified",
                description: "The booking was cancelled and notification logs have been generated.",
            });
        } catch (emailError) {
            console.error("Failed to call send-email API for cancellation:", emailError);
            toast({
                title: "Booking Cancelled (Email API Failed)",
                description: "The booking was cancelled, but the email notification API could not be reached.",
                variant: "destructive"
            });
        }
      } else {
         toast({
            title: "Booking Cancelled",
            description: "The booking has been successfully cancelled. (No client email for notification).",
        });
      }

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

    const handleSaveNote = async () => {
    if (!currentUser?.uid || !editingBookingNotes) return;
    
    if (!noteDraft.trim()) {
        toast({ title: "Cannot Save Empty Note", description: "Please generate or type a note before saving.", variant: "destructive" });
        return;
    }

    const bookingId = editingBookingNotes.id;
    const currentNotes: Note[] = Array.isArray(editingBookingNotes.Notes) ? editingBookingNotes.Notes : [];
    let updatedNotes;

    if (editingNoteId) {
        // This is an edit of an existing note
        updatedNotes = currentNotes.map(note =>
            note.id === editingNoteId ? { ...note, text: noteDraft, timestamp: Date.now() } : note
        );
        setEditingNoteId(null); // Reset editing state
    } else {
        // This is a new note
        const newNote: Note = { id: generateNoteId(), text: noteDraft, timestamp: Date.now() };
        updatedNotes = [...currentNotes, newNote];
    }
    
    try {
        const bookingRefPath = `Appointments/${currentUser.uid}/${bookingId}`;
        await update(ref(db, bookingRefPath), { Notes: updatedNotes });
        toast({ title: "Note Saved", description: "The note has been successfully saved." });
        
        // Update local state to reflect the change
        const updatedBooking = { ...editingBookingNotes, Notes: updatedNotes };
        setEditingBookingNotes(updatedBooking);
        setAllFetchedBookings(prevBookings => prevBookings.map(b =>
            b.id === bookingId ? updatedBooking : b
        ));
        setNoteDraft(''); // Clear the draft area after saving

    } catch (error: any) {
        console.error("Error saving note:", error);
        toast({ title: "Error Saving Note", description: error.message, variant: "destructive" });
    }
  };
  
    // --- Voice Recording Logic ---
  const startRecording = async () => {
    if (isRecording) return;
    try {
        if (!hasMicPermission) {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            setHasMicPermission(true);
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            setIsRecording(false);
            setIsTranscribing(true);
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = reader.result as string;
                try {
                    const result = await transcribeAudio({ 
                        audioDataUri: base64Audio,
                        existingNoteText: noteDraft 
                    });
                    if (result) {
                        const formattedNote = `S: ${result.subjective}\n\nO: ${result.objective}\n\nA: ${result.assessment}\n\nP: ${result.plan}`;
                        setNoteDraft(formattedNote);
                        toast({ title: "Note draft updated." });
                    } else {
                        toast({ title: "Transcription failed", description: "Could not transcribe audio.", variant: "destructive" });
                    }
                } catch (error) {
                    console.error("Transcription error:", error);
                    toast({ title: "Transcription Error", description: "An error occurred during transcription.", variant: "destructive" });
                } finally {
                    setIsTranscribing(false);
                }
            };
        };

        mediaRecorder.start();
        setIsRecording(true);
    } catch (error) {
        console.error("Error starting recording:", error);
        toast({ title: "Microphone Error", description: "Could not access microphone. Please check permissions.", variant: "destructive" });
        setHasMicPermission(false);
    }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
          // The onstop event will handle the rest
      }
  };


  // --- Edit Booking Logic ---
  const fetchBookedSlotsForEditForm = useCallback(async (selectedDate: Date, currentEditingBookingId: string | null) => {
    if (!currentUser || !selectedDate) {
      setEditBookedTimeSlotsForDate(new Set());
      return;
    }
    setIsLoadingEditBookedSlots(true);
    const formattedDate = format(selectedDate, "yyyy-MM-dd");
    const userAppointmentsRefPath = `Appointments/${currentUser.uid}`;
    const appointmentsRef = ref(db, userAppointmentsRefPath);
    const appointmentsQuery = rtQuery(appointmentsRef, orderByChild('AppointmentDate'), equalTo(formattedDate));

    try {
      const snapshot = await get(appointmentsQuery);
      const newBookedSlots = new Set<string>();
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const bookingId = childSnapshot.key;
          // Exclude the booking currently being edited from conflict calculation
          if (bookingId === currentEditingBookingId) return;

          const booking = childSnapshot.val() as Booking;
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
              console.error("Error parsing booking times for edit form:", booking, parseError);
            }
          }
        });
      }
      setEditBookedTimeSlotsForDate(newBookedSlots);
    } catch (error) {
      console.error("Error fetching booked slots for edit form:", error);
      toast({
        title: "Error loading schedule for edit",
        description: "Could not fetch existing bookings for this date.",
        variant: "destructive",
      });
      setEditBookedTimeSlotsForDate(new Set());
    } finally {
      setIsLoadingEditBookedSlots(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    if (editFormState?.appointmentDate && bookingToEdit) {
      fetchBookedSlotsForEditForm(editFormState.appointmentDate, bookingToEdit.id);
    } else {
      setEditBookedTimeSlotsForDate(new Set());
    }
  }, [editFormState?.appointmentDate, bookingToEdit, fetchBookedSlotsForEditForm]);


  const handleEditBookingClick = (booking: Booking) => {
    setBookingToEdit(booking);
    setEditFormState({
      serviceProcedure: booking.ServiceProcedure,
      appointmentDate: parseISO(booking.AppointmentDate),
      appointmentStartTime: booking.AppointmentStartTime,
      appointmentEndTime: booking.AppointmentEndTime,
    });
  };

  const handleUpdateBooking = async () => {
    if (!currentUser?.uid || !currentUser.email || !bookingToEdit || !editFormState) {
      toast({ title: "Error", description: "Cannot update booking. Missing information.", variant: "destructive" });
      return;
    }
    setIsEditSubmitting(true);

    const { serviceProcedure, appointmentDate, appointmentStartTime, appointmentEndTime } = editFormState;

    if (!serviceProcedure || !appointmentDate || !appointmentStartTime || !appointmentEndTime) {
        toast({ title: "Validation Error", description: "All fields are required.", variant: "destructive" });
        setIsEditSubmitting(false);
        return;
    }
    
    const formattedDate = format(appointmentDate, "yyyy-MM-dd");
    const baseDateForValidation = new Date(formattedDate + "T00:00:00");
    const startDateTime = parse(appointmentStartTime, "HH:mm", baseDateForValidation);
    const endDateTime = parse(appointmentEndTime, "HH:mm", baseDateForValidation);

    if (endDateTime <= startDateTime) {
      toast({ title: "Validation Error", description: "End time must be after start time.", variant: "destructive" });
      setIsEditSubmitting(false);
      return;
    }

    let tempSlot = startDateTime;
    let hasOverlap = false;
    while(tempSlot < endDateTime) {
        if(editBookedTimeSlotsForDate.has(format(tempSlot, "HH:mm"))) {
            hasOverlap = true;
            break;
        }
        tempSlot = addMinutes(tempSlot, 30);
    }

    if(hasOverlap) {
        toast({ title: "Booking Conflict", description: "The new time range overlaps with an existing booking.", variant: "destructive" });
        setIsEditSubmitting(false);
        return;
    }

    const updates: Partial<Booking> = {
      ServiceProcedure: serviceProcedure,
      AppointmentDate: formattedDate,
      AppointmentStartTime: appointmentStartTime,
      AppointmentEndTime: appointmentEndTime,
    };

    try {
      const bookingRefPath = `Appointments/${currentUser.uid}/${bookingToEdit.id}`;
      await update(ref(db, bookingRefPath), updates);

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Sync update to Google Calendar
      fetch('/api/google-calendar-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          bookingId: bookingToEdit.id,
          userId: currentUser.uid,
          timeZone: timeZone,
        })
      }).then(res => res.json()).then(data => {
        if(data.success) console.log(`Successfully synced update for booking ${bookingToEdit.id} to Google Calendar.`);
        else console.warn(`Failed to sync update for booking ${bookingToEdit.id}:`, data.message);
      }).catch(err => console.error("Error calling calendar sync for update:", err));


      if (bookingToEdit.ClientEmail) {
        const oldDetails = {
            date: format(parseISO(bookingToEdit.AppointmentDate), "PPP"),
            time: `${bookingToEdit.AppointmentStartTime} - ${bookingToEdit.AppointmentEndTime}`,
            service: bookingToEdit.ServiceProcedure,
        };
        const newDetails = {
            date: format(appointmentDate, "PPP"),
            time: `${appointmentStartTime} - ${appointmentEndTime}`,
            service: serviceProcedure,
        };
         try {
            const emailPayload = {
                action: 'sendUpdate',
                providerName: currentUser.displayName || 'Your Provider',
                providerEmail: currentUser.email,
                clientName: bookingToEdit.ClientName || 'Valued Client',
                clientEmail: bookingToEdit.ClientEmail,
                oldDetails: oldDetails,
                newDetails: newDetails,
            };
            await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emailPayload),
            });
            toast({ title: "Booking Updated & Notified", description: "The booking has been successfully updated and notification logs generated." });
        } catch (emailError) {
            console.error("Failed to call send-email API for update:", emailError);
            toast({ title: "Booking Updated (Email API Failed)", description: "The booking was updated, but email notifications failed.", variant: "destructive" });
        }
      } else {
        toast({ title: "Booking Updated", description: "The booking has been successfully updated. (No client email for notification)." });
      }

      fetchAndSetAllBookings();
      setBookingToEdit(null);
      setEditFormState(null);
    } catch (error: any) {
      console.error("Error updating booking:", error);
      toast({ title: "Error Updating Booking", description: error.message, variant: "destructive" });
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleEditFormChange = (field: keyof EditBookingFormState, value: any) => {
    setEditFormState(prev => prev ? { ...prev, [field]: value } : null);
    if (field === 'appointmentDate') {
      // Reset times if date changes to force re-selection based on new availability
      setEditFormState(prev => prev ? { ...prev, appointmentStartTime: '', appointmentEndTime: '' } : null);
    }
  };

  // --- End of Edit Booking Logic ---

  // --- Note Edit/Delete Logic ---
  const handleEditNoteClick = (noteToEdit: Note) => {
    setNoteDraft(noteToEdit.text);
    setEditingNoteId(noteToEdit.id);
    setActiveNotesTab("draft");
  };

  const handleDeleteNote = async (bookingId: string, noteId: string) => {
    if (!currentUser?.uid || !bookingId || !noteId) return;

    try {
        const bookingRefPath = `Appointments/${currentUser.uid}/${bookingId}`;
        const targetBooking = allFetchedBookings.find(b => b.id === bookingId);
        if (!targetBooking || !targetBooking.Notes) {
          throw new Error("Booking or notes not found for deletion.");
        }
        
        const updatedNotes = targetBooking.Notes.filter(n => n.id !== noteId);
        await update(ref(db, bookingRefPath), { Notes: updatedNotes });
        toast({ title: "Note Deleted", description: "The selected note has been deleted." });

        // Update local state immediately
        const updatedBooking = { ...targetBooking, Notes: updatedNotes };
        setEditingBookingNotes(updatedBooking);
        setAllFetchedBookings(prevBookings => prevBookings.map(b =>
            b.id === bookingId ? updatedBooking : b
        ));
    } catch(error: any) {
        console.error("Error deleting note:", error);
        toast({ title: "Error Deleting Note", description: error.message, variant: "destructive" });
    }
  };
  // --- End of Note Logic ---

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

  const renderNoteWithBold = (text: string) => {
    if (!text) return { __html: '' };
    const html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return { __html: html.replace(/\n/g, '<br />') };
  };
  
  const mostRecentNote = useMemo(() => {
    if (!editingBookingNotes?.Notes || editingBookingNotes.Notes.length === 0) {
      return null;
    }
    return [...editingBookingNotes.Notes].sort((a, b) => b.timestamp - a.timestamp)[0];
  }, [editingBookingNotes]);

  const closeAndResetNotesDialog = () => {
    setEditingBookingNotes(null);
    setNoteDraft('');
    setEditingNoteId(null);
    setActiveNotesTab("draft");
  };

  const handleOpenNotesDialog = (booking: Booking) => {
    setEditingBookingNotes(booking);
    setNoteDraft('');
    setEditingNoteId(null);
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
          © {new Date().getFullYear()} Appointa. All rights reserved.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {/* Dialog for Editing Booking Notes */}
      <Dialog open={!!editingBookingNotes} onOpenChange={(isOpen) => { if (!isOpen) closeAndResetNotesDialog() }}>
        <DialogContent className="sm:max-w-4xl grid-rows-[auto_1fr_auto]">
          <DialogHeader>
            <DialogTitle>
              Manage Note for {editingBookingNotes?.ClientName}
            </DialogTitle>
            <DialogDescription>
              Appointment on {editingBookingNotes && format(parseISO(editingBookingNotes.AppointmentDate), "PPP")} at {editingBookingNotes?.AppointmentStartTime} - {editingBookingNotes?.AppointmentEndTime}
            </DialogDescription>
          </DialogHeader>
            <Tabs value={activeNotesTab} onValueChange={setActiveNotesTab} className="py-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="draft">Draft / Edit Note</TabsTrigger>
                <TabsTrigger value="history">All Notes ({editingBookingNotes?.Notes?.length || 0})</TabsTrigger>
              </TabsList>
              
              <TabsContent value="draft" className="mt-4 space-y-4">
                {mostRecentNote && !editingNoteId && (
                  <div>
                    <Label className="font-semibold text-sm">Most Recent Note</Label>
                    <div className="text-xs p-3 mt-1 bg-muted/50 rounded-md border">
                        <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={renderNoteWithBold(mostRecentNote.text)}></p>
                        <p className="text-muted-foreground text-right text-[10px] mt-1">
                          {format(new Date(mostRecentNote.timestamp), "MMM d, yyyy h:mm a")}
                        </p>
                    </div>
                  </div>
                )}
                
                <div>
                   <div className="flex justify-between items-center mb-1">
                    <Label htmlFor="note-draft" className="font-semibold text-sm">{editingNoteId ? 'Editing Note' : 'New Note Draft'}</Label>
                     <Button
                          type="button"
                          size="sm"
                          variant={isRecording ? "destructive" : "outline"}
                          className={cn("h-8 w-auto px-3", isRecording && "animate-pulse")}
                          onMouseDown={startRecording}
                          onMouseUp={stopRecording}
                          onTouchStart={startRecording}
                          onTouchEnd={stopRecording}
                          disabled={isTranscribing}
                          title={isRecording ? "Release to stop" : "Hold to record"}
                      >
                          {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Mic className="h-4 w-4 mr-2" />}
                          {isRecording ? "Recording..." : isTranscribing ? "Processing..." : "Record"}
                          <span className="sr-only">{isRecording ? "Stop recording" : "Start recording"}</span>
                      </Button>
                  </div>
                   <Textarea
                      id="note-draft"
                      placeholder="Hold the record button to dictate a new note, or type here..."
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      rows={8}
                      className="mt-1"
                      disabled={isRecording || isTranscribing}
                  />
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                 {editingBookingNotes?.Notes && editingBookingNotes.Notes.length > 0 ? (
                    <ScrollArea className="h-[350px] w-full rounded-md border p-3">
                      <ul className="space-y-2">
                        {[...editingBookingNotes.Notes].sort((a,b) => b.timestamp - a.timestamp).map((note) => (
                          <li key={note.id} className="text-xs p-2 bg-muted/50 rounded flex items-start justify-between gap-2">
                            <div>
                                <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={renderNoteWithBold(note.text)}></p>
                                <p className="text-muted-foreground text-right text-[10px] mt-1">
                                {format(new Date(note.timestamp), "MMM d, yyyy h:mm a")}
                                </p>
                            </div>
                            <div className="flex items-center shrink-0">
                               <Button variant="ghost" size="icon" className="h-6 w-6 p-1 text-muted-foreground hover:text-primary" onClick={() => handleEditNoteClick(note)}>
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit note</span>
                               </Button>
                               <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 p-1 text-muted-foreground hover:text-destructive">
                                          <Trash2 className="h-4 w-4" />
                                          <span className="sr-only">Delete note</span>
                                      </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                          <AlertDialogDescription>This action will permanently delete this note. This cannot be undone.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteNote(editingBookingNotes.id, note.id)} className="bg-destructive hover:bg-destructive/90">Delete Note</AlertDialogAction>
                                      </AlertDialogFooter>
                                  </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                ) : (
                    <p className="text-sm text-muted-foreground p-3 text-center border rounded-md">No notes found for this booking.</p>
                )}
              </TabsContent>
            </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={closeAndResetNotesDialog}>Close</Button>
            <Button onClick={handleSaveNote} disabled={isRecording || isTranscribing}>
              <Save className="mr-2 h-4 w-4" /> Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog for Editing Booking Details */}
      <Dialog open={!!bookingToEdit} onOpenChange={(isOpen) => { if (!isOpen) { setBookingToEdit(null); setEditFormState(null);} }}>
         <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Booking for {bookingToEdit?.ClientName}</DialogTitle>
            <DialogDescription>
              Modify the details for this appointment.
            </DialogDescription>
          </DialogHeader>
          {editFormState && bookingToEdit && (
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="editServiceProcedure">Service/Procedure *</Label>
                <Textarea
                  id="editServiceProcedure"
                  value={editFormState.serviceProcedure}
                  onChange={(e) => handleEditFormChange('serviceProcedure', e.target.value)}
                  required
                  className="mt-1"
                  placeholder="Describe the service"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <Label htmlFor="editAppointmentDate">Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal mt-1", !editFormState.appointmentDate && "text-muted-foreground")}
                      >
                        <CalendarIconLucide className="mr-2 h-4 w-4" />
                        {editFormState.appointmentDate ? format(editFormState.appointmentDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={editFormState.appointmentDate}
                        onSelect={(day) => handleEditFormChange('appointmentDate', day)}
                        disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="sm:col-span-1">
                  <Label htmlFor="editAppointmentStartTime">Start Time *</Label>
                  <Select
                    value={editFormState.appointmentStartTime}
                    onValueChange={(value) => handleEditFormChange('appointmentStartTime', value)}
                    disabled={isLoadingEditBookedSlots || !editFormState.appointmentDate}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder={isLoadingEditBookedSlots ? "Loading..." : "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingEditBookedSlots && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                      {!isLoadingEditBookedSlots && timeSlots.map(slot => (
                        <SelectItem
                          key={`edit-start-${slot}`}
                          value={slot}
                          disabled={editBookedTimeSlotsForDate.has(slot)}
                        >
                          {slot}{editBookedTimeSlotsForDate.has(slot) ? " (Booked)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-1">
                  <Label htmlFor="editAppointmentEndTime">End Time *</Label>
                  <Select
                    value={editFormState.appointmentEndTime}
                    onValueChange={(value) => handleEditFormChange('appointmentEndTime', value)}
                    disabled={isLoadingEditBookedSlots || !editFormState.appointmentDate || !editFormState.appointmentStartTime}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder={isLoadingEditBookedSlots ? "Loading..." : "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingEditBookedSlots && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                      {!isLoadingEditBookedSlots && timeSlots.filter(slot => {
                        if (!editFormState.appointmentStartTime || !editFormState.appointmentDate) return true;
                        const baseDate = new Date(editFormState.appointmentDate); baseDate.setHours(0,0,0,0);
                        return parse(slot, "HH:mm", baseDate) > parse(editFormState.appointmentStartTime, "HH:mm", baseDate);
                      }).map(slot => {
                        let itemIsDisabled = false;
                        let itemLabelSuffix = "";
                        if (editFormState.appointmentStartTime && editFormState.appointmentDate) {
                            const baseDate = new Date(editFormState.appointmentDate); baseDate.setHours(0,0,0,0);
                            const newBookingStart = parse(editFormState.appointmentStartTime, "HH:mm", baseDate);
                            const potentialEnd = parse(slot, "HH:mm", baseDate);
                            let tempCheck = newBookingStart;
                            while (tempCheck < potentialEnd) {
                                if (editBookedTimeSlotsForDate.has(format(tempCheck, "HH:mm"))) {
                                    itemIsDisabled = true;
                                    itemLabelSuffix = " (Conflicts)";
                                    break;
                                }
                                tempCheck = addMinutes(tempCheck, 30);
                            }
                        } else if (!editFormState.appointmentStartTime) {
                            itemIsDisabled = true;
                        }
                        return (
                          <SelectItem key={`edit-end-${slot}`} value={slot} disabled={itemIsDisabled}>
                            {slot}{itemLabelSuffix}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
               {isLoadingEditBookedSlots && editFormState.appointmentDate && (
                  <div className="text-xs text-muted-foreground flex items-center">
                    <svg className="animate-spin mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Checking availability...
                  </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBookingToEdit(null); setEditFormState(null); }}>Cancel</Button>
            <Button onClick={handleUpdateBooking} disabled={isEditSubmitting || isLoadingEditBookedSlots || !editFormState}>
              {isEditSubmitting ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


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
                    <div className="overflow-x-auto">
                      <WeeklyCalendarView 
                        bookings={allFetchedBookings} 
                        currentDate={weekViewDate} 
                        onDayClick={(date) => {
                            handleCalendarDayClick(date);
                        }}
                        onBookingClick={(booking) => {
                          if (booking.BookingStatus !== "Cancelled") {
                            handleEditBookingClick(booking);
                          }
                        }}
                      />
                    </div>
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
                  View and filter all your bookings. Click the <Edit className="inline h-4 w-4" /> icon to manage notes, or <Edit3 className="inline h-4 w-4" /> to edit booking details.
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
                        <TableHead className="w-[150px]">Latest Note</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[180px]">Actions</TableHead>
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
                          <TableCell className="text-sm text-muted-foreground">
                            <div className="flex items-center justify-between gap-2">
                               <p
                                className="truncate max-w-[150px]"
                                title={booking.Notes && booking.Notes.length > 0 ? [...booking.Notes].sort((a,b) => b.timestamp - a.timestamp)[0].text : 'N/A'}
                                dangerouslySetInnerHTML={
                                  booking.Notes && booking.Notes.length > 0
                                    ? renderNoteWithBold([...booking.Notes].sort((a, b) => b.timestamp - a.timestamp)[0].text)
                                    : { __html: 'N/A' }
                                }
                              />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0 shrink-0"
                                  onClick={() => handleOpenNotesDialog(booking)}
                                >
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Manage Notes</span>
                                </Button>
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
                            <div className="flex items-center gap-1">
                              {booking.BookingStatus !== "Cancelled" && (
                                <Button variant="outline" size="sm" className="h-8 px-2 py-1" onClick={() => handleEditBookingClick(booking)}>
                                  <Edit3 className="mr-1 h-3 w-3" /> Edit
                                </Button>
                              )}
                              {booking.BookingStatus === "Booked" && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" className="h-8 px-2 py-1">
                                      <XCircle className="mr-1 h-3 w-3" /> Cancel
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
                                      <AlertDialogAction onClick={() => handleCancelBooking(booking)}>
                                        Confirm Cancellation
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
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
      <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">
        © {new Date().getFullYear()} Appointa. All rights reserved.
      </footer>
    </div>
  );
}
