
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { User, Calendar as CalendarIconLucide, Briefcase, Mail, Phone, Clock, FileText, Trash2, AlertTriangle, Edit } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ref, get, query as rtQuery, orderByChild, equalTo, remove, update } from "firebase/database";
import { db } from '@/lib/firebaseConfig';

interface Note {
  id: string;
  text: string;
  timestamp: number;
}

interface Client {
  id: string;
  ClientID: string;
  ClientName: string;
  ClientEmail?: string; 
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
  Notes?: Note[];
  BookedByUserID?: string;
  googleEventId?: string;
}

interface ProcessedNote {
  id: string; 
  noteText: string;
  noteTimestamp: number;
  serviceProcedure: string;
  appointmentDate: string; 
  bookingId: string;
}

interface EditClientFormState {
    ClientName: string;
    ClientEmail: string;
    ClientContact: string;
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
  const [allClientNotes, setAllClientNotes] = useState<ProcessedNote[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [editClientForm, setEditClientForm] = useState<EditClientFormState | null>(null);
  const [isSavingClient, setIsSavingClient] = useState(false);


  const fetchClientDetails = useCallback(async () => {
    if (!currentUser?.uid || !clientId) return;
    setIsLoadingClient(true);
    try {
      const clientRef = ref(db, `Clients/${currentUser.uid}/${clientId}`);
      const snapshot = await get(clientRef);
      if (snapshot.exists()) {
        const clientData = { id: snapshot.key, ...snapshot.val() } as Client;
        setClient(clientData);
        setEditClientForm({
            ClientName: clientData.ClientName || '',
            ClientEmail: clientData.ClientEmail || '',
            ClientContact: clientData.ClientContact || ''
        });
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
          const bookingData = childSnapshot.val();
          let processedNotes: Note[] = [];
           if (bookingData.Notes) {
            if (Array.isArray(bookingData.Notes)) {
              processedNotes = bookingData.Notes.filter((n: any) => n && typeof n.text === 'string' && typeof n.timestamp === 'number' && typeof n.id === 'string');
            } else if (typeof bookingData.Notes === 'object' && !Array.isArray(bookingData.Notes)) {
              processedNotes = Object.values(bookingData.Notes as Record<string, Note>).filter((n: any) => n && typeof n.text === 'string' && typeof n.timestamp === 'number' && typeof n.id === 'string');
            }
          }
          fetchedBookings.push({
            id: childSnapshot.key as string,
            ...bookingData,
            Notes: processedNotes,
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
  
  const handleDeleteClient = async () => {
    if (!currentUser?.uid || !client) {
      toast({ title: "Error", description: "Cannot delete client. User or client data missing.", variant: "destructive" });
      return;
    }
    setIsDeleting(true);

    try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const appointmentDeletionPromises: Promise<any>[] = [];

        for (const booking of bookings) {
            if (booking.googleEventId) {
                const gcalSyncPromise = fetch('/api/google-calendar-sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'delete',
                        bookingId: booking.id,
                        userId: currentUser.uid,
                        timeZone: timeZone,
                    })
                }).catch(err => console.error(`Failed to sync calendar deletion for booking ${booking.id}:`, err));
                appointmentDeletionPromises.push(gcalSyncPromise);
            }
            
            const appointmentRef = ref(db, `Appointments/${currentUser.uid}/${booking.id}`);
            appointmentDeletionPromises.push(remove(appointmentRef));
        }
        
        await Promise.all(appointmentDeletionPromises);

        const clientRef = ref(db, `Clients/${currentUser.uid}/${client.id}`);
        await remove(clientRef);

        toast({
            title: "Client Deleted",
            description: `${client.ClientName} and all their associated bookings have been permanently deleted.`,
        });

        router.push('/client-search');

    } catch (error: any) {
        console.error("Error deleting client:", error);
        toast({
            title: "Deletion Failed",
            description: error.message || "An unexpected error occurred while deleting the client.",
            variant: "destructive",
        });
    } finally {
        setIsDeleting(false);
    }
  };

  const handleUpdateClient = async () => {
    if (!currentUser?.uid || !client || !editClientForm) {
        toast({ title: "Error", description: "Cannot update client. Missing required data.", variant: "destructive"});
        return;
    }

    if (!editClientForm.ClientName.trim()) {
        toast({ title: "Validation Error", description: "Client name cannot be empty.", variant: "destructive"});
        return;
    }

    setIsSavingClient(true);
    try {
        const clientRef = ref(db, `Clients/${currentUser.uid}/${client.id}`);
        const updates: Partial<Client> = {
            ClientName: editClientForm.ClientName.trim(),
            ClientEmail: editClientForm.ClientEmail.trim(),
            ClientContact: editClientForm.ClientContact.trim(),
        };
        await update(clientRef, updates);
        toast({ title: "Client Updated", description: "The client's details have been saved." });
        setIsEditClientOpen(false);
        fetchClientDetails(); // Re-fetch to update the view
    } catch (error: any) {
        console.error("Error updating client:", error);
        toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
        setIsSavingClient(false);
    }
  };

    const handleEditNote = (noteId: string) => {
        const bookingForNote = bookings.find(b => b.Notes?.some(n => n.id === noteId));
        if (bookingForNote) {
            router.push(`/all-bookings?openBooking=${bookingForNote.id}&editNote=${noteId}`);
        } else {
            toast({ title: "Error", description: "Could not find the booking associated with this note.", variant: "destructive" });
        }
    };


  const handleDeleteNote = async (bookingId: string, noteIdToDelete: string) => {
    if (!currentUser?.uid) return;

    try {
        const bookingRefPath = `Appointments/${currentUser.uid}/${bookingId}`;
        const targetBooking = bookings.find(b => b.id === bookingId);
        
        if (!targetBooking || !targetBooking.Notes) {
            throw new Error("Booking or notes not found for deletion.");
        }

        const updatedNotes = targetBooking.Notes.filter(n => n.id !== noteIdToDelete);
        await update(ref(db, bookingRefPath), { Notes: updatedNotes });
        toast({ title: "Note Deleted", description: "The selected note has been deleted." });

        fetchClientBookings();

    } catch (error: any) {
        console.error("Error deleting note from client page:", error);
        toast({ title: "Error Deleting Note", description: error.message, variant: "destructive" });
    }
  };


  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    } else if (currentUser && clientId) {
      fetchClientDetails();
      fetchClientBookings();
    }
  }, [currentUser, authLoading, clientId, router, fetchClientDetails, fetchClientBookings]);

  useEffect(() => {
    if (bookings.length > 0) {
      const notes: ProcessedNote[] = [];
      bookings.forEach(booking => {
        if (booking.Notes && Array.isArray(booking.Notes)) {
          booking.Notes.forEach(note => {
            notes.push({
              id: note.id,
              noteText: note.text,
              noteTimestamp: note.timestamp,
              serviceProcedure: booking.ServiceProcedure,
              appointmentDate: booking.AppointmentDate,
              bookingId: booking.id,
            });
          });
        }
      });
      notes.sort((a, b) => b.noteTimestamp - a.noteTimestamp); 
      setAllClientNotes(notes);
    } else {
      setAllClientNotes([]);
    }
  }, [bookings]);

  const renderNoteWithBold = (text: string) => {
    if (!text) return { __html: '' };
    const html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return { __html: html };
  };


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
          © {new Date().getFullYear()} Appointa. All rights reserved.
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
          © {new Date().getFullYear()} Appointa. All rights reserved.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
        {/* Edit Client Dialog */}
        <Dialog open={isEditClientOpen} onOpenChange={setIsEditClientOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Client Details</DialogTitle>
                    <DialogDescription>Update the information for {client.ClientName}.</DialogDescription>
                </DialogHeader>
                {editClientForm && (
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label htmlFor="editClientName">Client Name</Label>
                            <Input
                                id="editClientName"
                                value={editClientForm.ClientName}
                                onChange={(e) => setEditClientForm(prev => prev ? { ...prev, ClientName: e.target.value } : null)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="editClientEmail">Client Email</Label>
                            <Input
                                id="editClientEmail"
                                type="email"
                                value={editClientForm.ClientEmail}
                                onChange={(e) => setEditClientForm(prev => prev ? { ...prev, ClientEmail: e.target.value } : null)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="editClientContact">Client Phone</Label>
                            <Input
                                id="editClientContact"
                                type="tel"
                                value={editClientForm.ClientContact}
                                onChange={(e) => setEditClientForm(prev => prev ? { ...prev, ClientContact: e.target.value } : null)}
                                className="mt-1"
                            />
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEditClientOpen(false)}>Cancel</Button>
                    <Button onClick={handleUpdateClient} disabled={isSavingClient}>
                        {isSavingClient ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      <main className="flex-grow py-10">
        <div className="container max-w-5xl mx-auto space-y-8">
          <Card className="shadow-xl">
            <CardHeader>
              <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-3xl font-bold flex items-center text-primary">
                            <User className="mr-3 h-8 w-8" /> {client.ClientName}
                        </CardTitle>
                        <CardDescription>
                            Detailed information and history for {client.ClientName}.
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsEditClientOpen(true)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit Client
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-muted-foreground">Client Information</h3>
                {client.ClientEmail && (
                  <p className="flex items-center">
                    <Mail className="mr-2 h-5 w-5 text-primary/80" />
                    <span className="font-medium">Email:</span> {client.ClientEmail}
                  </p>
                )}
                {client.ClientContact && ( 
                  <p className="flex items-center">
                    <Phone className="mr-2 h-5 w-5 text-primary/80" />
                    <span className="font-medium">Phone:</span> {client.ClientContact}
                  </p>
                )}
                <p className="flex items-center"><CalendarIconLucide className="mr-2 h-5 w-5 text-primary/80" /> <span className="font-medium">Date Created:</span> {format(parseISO(client.CreateDate), "PPP")}</p>
                <p className="flex items-center"><Clock className="mr-2 h-5 w-5 text-primary/80" /> <span className="font-medium">Time Created:</span> {client.CreateTime}</p>
              </div>
                <div className="space-y-3 self-start md:justify-self-end">
                    <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
                     <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button variant="destructive" disabled={isDeleting}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Client
                         </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-destructive" /> Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete <strong>{client.ClientName}</strong> and all of their associated bookings and notes.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteClient} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                {isDeleting ? (
                                    <>
                                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                      Deleting...
                                    </>
                                 ) : "Yes, delete client"}
                              </AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
                </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="bookingHistory" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bookingHistory" className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" /> Booking History
              </TabsTrigger>
              <TabsTrigger value="allNotes" className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> All Notes
              </TabsTrigger>
            </TabsList>
            <TabsContent value="bookingHistory">
              <Card className="shadow-xl mt-2">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">
                    Booking History
                  </CardTitle>
                   <CardDescription>A list of all bookings for {client.ClientName}.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingBookings ? (
                    <div className="text-center py-10">
                        <svg className="animate-spin mx-auto h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <p className="mt-2 text-muted-foreground">Loading bookings...</p>
                    </div>
                  ) : bookings.length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">Service/Procedure</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>End</TableHead>
                            <TableHead className="w-[200px]">Latest Note</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bookings.map((booking) => (
                            <TableRow key={booking.id}>
                              <TableCell className="font-medium">{booking.ServiceProcedure}</TableCell>
                              <TableCell>{format(parseISO(booking.AppointmentDate), "PPP")}</TableCell>
                              <TableCell>{booking.AppointmentStartTime}</TableCell>
                              <TableCell>{booking.AppointmentEndTime}</TableCell>
                               <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                                <p 
                                  className="whitespace-pre-wrap"
                                  title={booking.Notes && booking.Notes.length > 0 ? booking.Notes.slice().sort((a, b) => b.timestamp - a.timestamp)[0].text : 'N/A'}
                                  dangerouslySetInnerHTML={
                                    booking.Notes && booking.Notes.length > 0
                                      ? renderNoteWithBold(booking.Notes.slice().sort((a, b) => b.timestamp - a.timestamp)[0].text)
                                      : { __html: 'N/A' }
                                  }
                                ></p>
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
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-muted-foreground">{client.ClientName} has no bookings yet.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="allNotes">
              <Card className="shadow-xl mt-2">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold">
                    All Notes
                  </CardTitle>
                  <CardDescription>A comprehensive list of all notes for {client.ClientName}'s bookings.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingBookings ? (
                     <div className="text-center py-10">
                        <svg className="animate-spin mx-auto h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <p className="mt-2 text-muted-foreground">Loading notes...</p>
                    </div>
                  ) : allClientNotes.length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">Note Created</TableHead>
                            <TableHead>Note</TableHead>
                            <TableHead className="w-[200px]">Associated Service</TableHead>
                            <TableHead className="w-[150px]">Appointment Date</TableHead>
                             <TableHead className="w-[100px] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allClientNotes.map((note) => (
                            <TableRow key={note.id}>
                              <TableCell className="text-sm">
                                {format(new Date(note.noteTimestamp), "PPPp")}
                              </TableCell>
                               <TableCell className="text-sm">
                                <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={renderNoteWithBold(note.noteText)}></p>
                              </TableCell>
                              <TableCell className="text-sm">{note.serviceProcedure}</TableCell>
                              <TableCell className="text-sm">{format(parseISO(note.appointmentDate), "PPP")}</TableCell>
                              <TableCell className="text-right">
                                 <div className="flex items-center justify-end">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 p-1 text-muted-foreground hover:text-primary" onClick={() => handleEditNote(note.id)}>
                                          <Edit className="h-4 w-4" />
                                          <span className="sr-only">Edit note</span>
                                      </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 p-1 text-muted-foreground hover:text-destructive">
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
                                                <AlertDialogAction onClick={() => handleDeleteNote(note.bookingId, note.id)} className="bg-destructive hover:bg-destructive/90">Delete Note</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                 </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-muted-foreground">No notes found for {client.ClientName}.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">
        © {new Date().getFullYear()} Appointa. All rights reserved.
      </footer>
    </div>
  );
}

