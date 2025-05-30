
"use client";

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIconLucideShadcn } from "@/components/ui/calendar"; // Renamed to avoid conflict
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
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
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h.toString().padStart(2, '0');
      const minute = m.toString().padStart(2, '0');
      slots.push(`${hour}:${minute}`);
    }
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

    const { currentUser, loading: authLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!authLoading && !currentUser) {
        router.push('/login');
      }
    }, [currentUser, authLoading, router]);


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

        if (date && startTime && endTime) {
          const startDateTime = new Date(`${format(date, 'yyyy-MM-dd')}T${startTime}`);
          const endDateTime = new Date(`${format(date, 'yyyy-MM-dd')}T${endTime}`);
          if (endDateTime <= startDateTime) {
            toast({
              title: "Validation Error",
              description: "End time must be after start time.",
              variant: "destructive",
            });
            setIsSubmitting(false);
            return;
          }
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
            let clientId: string;
            const userClientsRefPath = `Clients/${currentUser.uid}`;
            const clientsRef = ref(db, userClientsRefPath);
            const clientQuery = rtQuery(clientsRef, orderByChild('ClientName'), equalTo(clientName));
            const clientSnapshot = await get(clientQuery);

            if (clientSnapshot.exists()) {
                clientSnapshot.forEach((childSnapshot) => {
                    clientId = childSnapshot.key as string;
                });
                clientId = clientId!; 
            } else {
                clientId = generateAlphanumericID(10); // Use this as the key for the new client
                const now = new Date();
                const createDate = now.toISOString().split('T')[0];
                const createTime = now.toLocaleTimeString();
                
                await set(ref(db, `${userClientsRefPath}/${clientId}`), {
                    ClientID: clientId, 
                    ClientName: clientName,
                    ClientContact: clientContact,
                    CreateDate: createDate,
                    CreateTime: createTime,
                    CreatedByUserID: currentUser.uid 
                });
            }

            const userAppointmentsRefPath = `Appointments/${currentUser.uid}`;
            const appointmentsRef = ref(db, userAppointmentsRefPath);
            const newAppointmentRef = push(appointmentsRef); 
            const appointmentId = newAppointmentRef.key;
            const selectedDate = date ? format(date, 'yyyy-MM-dd') : '';

            await set(newAppointmentRef, {
                AppointmentID: appointmentId, 
                ClientID: clientId, 
                ServiceProcedure: serviceProcedure,
                AppointmentDate: selectedDate,
                AppointmentStartTime: startTime,
                AppointmentEndTime: endTime,
                BookedByUserID: currentUser.uid 
            });

            toast({
                title: "Success",
                description: "Booking Confirmed!",
            });

            setClientName('');
            setClientContact('');
            setServiceProcedure('');
            setDate(new Date());
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
                                            onSelect={setDate}
                                            disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                             <div className="flex-1">
                                <Label htmlFor="startTime" className="font-medium">Appointment Start Time *</Label>
                                <Select value={startTime} onValueChange={setStartTime} required>
                                    <SelectTrigger className="w-full mt-1">
                                        <SelectValue placeholder="Select start time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {timeSlots.map(slot => (
                                            <SelectItem key={`start-${slot}`} value={slot}>{slot}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1">
                                <Label htmlFor="endTime" className="font-medium">Appointment End Time *</Label>
                                 <Select value={endTime} onValueChange={setEndTime} required>
                                    <SelectTrigger className="w-full mt-1">
                                        <SelectValue placeholder="Select end time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {timeSlots.map(slot => (
                                            <SelectItem key={`end-${slot}`} value={slot}>{slot}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Separator className="my-4" />
                        <Button type="submit" disabled={isSubmitting} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold py-3">
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
