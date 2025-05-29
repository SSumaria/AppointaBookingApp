
"use client";

import React, { useState } from 'react';
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { CalendarIcon, Home, Search } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import Link from 'next/link';

// Firebase imports for Realtime Database
import { ref, set, get, query as rtQuery, orderByChild, equalTo, push } from "firebase/database";
import { db } from '@/lib/firebaseConfig'; // Import RTDB instance

// Function to generate a unique alphanumeric ClientID
function generateAlphanumericID(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export default function NewBookingPage() {
    const [clientName, setClientName] = useState('');
    const [clientContact, setClientContact] = useState('');
    const [serviceProcedure, setServiceProcedure] = useState('');
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [time, setTime] = useState('');
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Function to handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        if (!clientName || !serviceProcedure || !date || !time) {
            toast({
                title: "Error",
                description: "Please fill in all required fields.",
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
            let clientId: string;

            // Check if client exists based on the client's name
            const clientsRef = ref(db, 'Clients');
            const clientQuery = rtQuery(clientsRef, orderByChild('ClientName'), equalTo(clientName));
            const clientSnapshot = await get(clientQuery);

            if (clientSnapshot.exists()) {
                // Client exists, retrieve their ClientID
                // Assuming ClientName is unique for simplicity here.
                // If not unique, you'd need a more robust way to select the correct client.
                clientSnapshot.forEach((childSnapshot) => {
                    clientId = childSnapshot.key as string; // The key is the ClientID
                    // If multiple clients have the same name, this takes the first one.
                    // Consider a UI to select if multiple matches.
                });
                clientId = clientId!; // Ensure clientId is assigned
            } else {
                // Generate a unique alphanumeric ClientID for a new client
                clientId = generateAlphanumericID(10);
                const now = new Date();
                const createDate = now.toISOString().split('T')[0];
                const createTime = now.toLocaleTimeString();
                
                // Create a new client record in the Clients node
                // The key of the client record will be `clientId`
                await set(ref(db, 'Clients/' + clientId), {
                    ClientID: clientId,
                    ClientName: clientName,
                    ClientContact: clientContact,
                    CreateDate: createDate,
                    CreateTime: createTime,
                });
            }

            // Create new appointment record
            const appointmentsRef = ref(db, 'Appointments');
            const newAppointmentRef = push(appointmentsRef); // Generates a unique key for the appointment
            const appointmentId = newAppointmentRef.key;

            const selectedDate = date ? format(date, 'yyyy-MM-dd') : '';

            await set(newAppointmentRef, {
                AppointmentID: appointmentId, // Store the generated key as AppointmentID
                ClientID: clientId,
                ServiceProcedure: serviceProcedure,
                AppointmentDate: selectedDate,
                AppointmentTime: time
            });

            toast({
                title: "Success",
                description: "Booking Confirmed!",
            });

            // Reset form fields
            setClientName('');
            setClientContact('');
            setServiceProcedure('');
            setDate(new Date()); // Reset to today or undefined
            setTime('');

        } catch (error: any) {
            console.error("Error during booking:", error);
            toast({
                title: "Error",
                description: error.message || "An unexpected error occurred.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="bg-background py-4 shadow-sm">
                <div className="container max-w-5xl mx-auto flex items-center justify-between">
                    <Link href="/" className="text-2xl font-bold">
                        ServiceBooker Pro
                    </Link>
                    <nav className="flex items-center space-x-6">
                        <Link href="/" className="hover:text-primary flex items-center">
                            <Home className="mr-1 h-5 w-5" />
                            Home
                        </Link>
                        <Link href="/new-booking" className="hover:text-primary flex items-center text-primary">
                             <CalendarIcon className="mr-1 h-5 w-5" />
                             New Booking
                        </Link>
                        <Link href="/client-search" className="hover:text-primary flex items-center">
                            <Search className="mr-1 h-5 w-5" />
                            Client Search
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow py-10">
                <div className="container max-w-2xl mx-auto">
                    <h1 className="text-2xl font-bold mb-6 text-center">New Booking</h1>
                    <form onSubmit={handleSubmit} className="space-y-6 bg-card p-8 rounded-lg shadow-lg">
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
                                        <Calendar
                                            mode="single"
                                            selected={date}
                                            onSelect={setDate}
                                            disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))} // Disable past dates
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="flex-1">
                                <Label htmlFor="time" className="font-medium">Appointment Time *</Label>
                                <Input
                                    type="time"
                                    id="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    required
                                    className="mt-1 w-full"
                                />
                            </div>
                        </div>
                        <Separator className="my-4" />
                        <Button type="submit" disabled={isSubmitting} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold py-3">
                             {isSubmitting ? (
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : "Submit Booking"}
                        </Button>
                    </form>
                </div>
            </main>
            {/* Footer */}
            <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">
                 © {new Date().getFullYear()} ServiceBooker Pro. All rights reserved.
            </footer>
        </div>
    );
}
