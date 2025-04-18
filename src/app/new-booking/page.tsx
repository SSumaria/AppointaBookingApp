"use client";

import React, { useState, useEffect } from 'react';
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { format, set } from "date-fns"
import { CalendarIcon, Home, Search } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import Link from 'next/link';

// Firebase imports
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { firebaseConfig } from '@/lib/firebaseConfig';

// Initialize Firebase app and Firestore
let app: any;
let db: any;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} catch (error) {
    console.error("Firebase initialization error:", error);
    // Handle the error appropriately, e.g., display an error message to the user
}


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
    const { toast } = useToast()

    // Function to handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
      try {
        e.preventDefault();

        // Check if Firebase is initialized
        if (!db) {
            toast({
                title: "Error",
                description: "Firebase is not initialized. Please check your configuration.",
                variant: "destructive",
            });
            return;
        } if (!clientName || !serviceProcedure || !date || !time) { toast({ title: "Error",
                description: "Please fill in all required fields.",
                variant: "destructive",
              })
            return;
        }

        try {
            // Reference to the Clients collection
            const clientsCollection = collection(db, 'Clients');
            let clientId: string;

            // Check if client exists based on the client's name
            const clientQuery = query(clientsCollection, where('ClientName', '==', clientName));
            const clientQuerySnapshot = await getDocs(clientQuery);

            if (clientQuerySnapshot.empty) {
                // Generate a unique alphanumeric ClientID for a new client
                clientId = generateAlphanumericID(10);
                // Get current date and time for client creation
                const now = new Date(); // Current date and time
                const createDate = now.toISOString().split('T')[0]; // Format as YYYY-MM-DD
                const createTime = now.toLocaleTimeString(); // Format as HH:MM:SS
                
                 // Create a new client document in the Clients collection
                 await addDoc(clientsCollection, {
                    ClientID: clientId,  // Unique ID for the client
                    CreateDate: createDate,  // Date when the client was created
                    CreateTime: createTime,  // Time when the client was created
                    ClientName: clientName,  // Name of the client
                    ClientContact: clientContact // Contact details of the client
                }); 
            } else {
               // Retrieve ClientID if client exists
               clientId = clientQuerySnapshot.docs[0].data().ClientID;
            }

            // Create new appointment record
            const appointmentsCollection = collection(db, 'Appointments');

            // Format appointment date to avoid timezone issues
            const selectedDate = date ? format(date, 'yyyy-MM-dd') : ''; // YYYY-MM-DD

            await addDoc(appointmentsCollection, {
                ClientID: clientId,
                ServiceProcedure: serviceProcedure,
                AppointmentDate: selectedDate,
                AppointmentTime: time
            });

            // Show confirmation message
            try {
                toast({
                    title: "Success",
                    description: "Booking Confirmed!",
                });
            } catch (toastError: any) {
                console.error("Error displaying toast:", toastError);
            }

            // Reset form fields
            setClientName('');
            setClientContact('');
            setServiceProcedure('');
            setDate(undefined);
            setTime('');

        } catch (error: any) {
            console.error("Error during booking:", error);
             toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
              })
        }
      } catch (err) {
        console.log('Error in handleSubmit', err);
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
                        <Link href="/client-search" className="hover:text-primary flex items-center">
                            <Search className="mr-1 h-5 w-5" />
                            Client Search
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <div className="container max-w-2xl mx-auto py-10">
                <h1 className="text-2xl font-bold mb-4">New Booking</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="clientName">Client Name *</Label>
                        <Input
                            type="text"
                            id="clientName"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            required
                            className="w-full"
                        />
                    </div>
                    <div>
                        <Label htmlFor="clientContact">Client Contact (Phone or Email)</Label>
                        <Input
                            type="text"
                            id="clientContact"
                            value={clientContact}
                            onChange={(e) => setClientContact(e.target.value)}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <Label htmlFor="serviceProcedure">Service/Procedure *</Label>
                        <Textarea
                            id="serviceProcedure"
                            value={serviceProcedure}
                            onChange={(e) => setServiceProcedure(e.target.value)}
                            required
                            className="w-full"
                        />
                    </div>
                    <div className="flex gap-4">
                        <div>
                            <Label htmlFor="date">Appointment Date *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-[240px] justify-start text-left font-normal",
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
                                        disabled={(date) =>
                                            date < new Date()
                                        }
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div>
                            <Label htmlFor="time">Appointment Time *</Label>
                            <Input
                                type="time"
                                id="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                required
                                className="w-32"
                            />
                        </div>
                    </div>
                    <Separator className="my-2" />
                    <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/80 font-bold py-2 px-4 rounded">
                        Submit Booking
                    </Button>
                </form>
            </div>
        </div>
    );
}




