
"use client";

import React, { useState } from 'react';
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"

// Firebase imports
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { firebaseConfig } from '@/lib/firebaseConfig';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function NewBookingPage() {
    const [clientName, setClientName] = useState('');
    const [clientContact, setClientContact] = useState('');
    const [serviceProcedure, setServiceProcedure] = useState('');
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [time, setTime] = useState('');
    const [confirmationMessage, setConfirmationMessage] = useState('');
    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!clientName || !serviceProcedure || !date || !time) {
             toast({
                title: "Error",
                description: "Please fill in all required fields.",
                variant: "destructive",
              })
            return;
        }

        try {
            // 1. Check if client exists
            const clientsCollection = collection(db, 'Clients');
            const q = query(clientsCollection, where('ClientName', '==', clientName));
            const querySnapshot = await getDocs(q);

            let clientId: string;

            if (querySnapshot.empty) {
                // 2. Create new client if not exists
                const newClientDoc = await addDoc(clientsCollection, {
                    ClientName: clientName,
                    ClientContact: clientContact
                });
                clientId = newClientDoc.id;
            } else {
                // 3. Retrieve ClientID if client exists
                clientId = querySnapshot.docs[0].id;
            }

            // 4. Create new appointment record
            const appointmentsCollection = collection(db, 'Appointments');
            await addDoc(appointmentsCollection, {
                ClientID: clientId,
                ServiceProcedure: serviceProcedure,
                AppointmentDate: date.toISOString().split('T')[0], // Format date
                AppointmentTime: time
            });

            // 5. Show confirmation message
             toast({
                title: "Success",
                description: "Booking Confirmed!",
              })
            setClientName('');
            setClientContact('');
            setServiceProcedure('');
            setDate(undefined);
            setTime('');
            setConfirmationMessage('Booking Confirmed!');

        } catch (error: any) {
            console.error("Error during booking:", error);
             toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
              })
            setConfirmationMessage('Booking Failed. Please try again.');
        }
    };

    return (
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
                <Button type="submit" className="bg-accent text-primary-foreground hover:bg-accent/80 font-bold py-2 px-4 rounded">
                    Submit Booking
                </Button>

                {confirmationMessage && (
                    <div className="mt-4 p-3 bg-secondary rounded-md">
                        {confirmationMessage}
                    </div>
                )}
            </form>
        </div>
    );
}
