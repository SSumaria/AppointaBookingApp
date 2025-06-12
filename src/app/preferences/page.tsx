
"use client";

import React, { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, Clock, Ban } from "lucide-react";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format, addMinutes } from 'date-fns';

const generateFullDayTimeSlots = () => {
  const slots = [];
  let currentTime = new Date();
  currentTime.setHours(0, 0, 0, 0); // Start at 00:00 AM

  const endTimeLimit = new Date();
  endTimeLimit.setHours(23, 59, 0, 0); // Up to 23:59

  while (currentTime <= endTimeLimit) {
    slots.push(format(currentTime, "HH:mm"));
    // Increment by 15 or 30 minutes as preferred for granularity
    currentTime = addMinutes(currentTime, 30); 
  }
  // Ensure 23:59 is an option if not perfectly divisible
  if (slots[slots.length-1] !== "23:30" && slots[slots.length-1] !== "23:59") {
     // If last slot is 23:30, add 23:59 as a common end time. Or handle as desired.
  }
   if (!slots.includes("23:59")) slots.push("23:59");


  return slots;
};

const allTimeSlots = generateFullDayTimeSlots();

const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type DayOfWeek = typeof daysOfWeek[number];

interface DaySetting {
  startTime: string;
  endTime: string;
  isUnavailable: boolean;
}

type WorkingHours = Record<DayOfWeek, DaySetting>;

const initialWorkingHours: WorkingHours = {
  monday:    { startTime: "09:00", endTime: "17:00", isUnavailable: false },
  tuesday:   { startTime: "09:00", endTime: "17:00", isUnavailable: false },
  wednesday: { startTime: "09:00", endTime: "17:00", isUnavailable: false },
  thursday:  { startTime: "09:00", endTime: "17:00", isUnavailable: false },
  friday:    { startTime: "09:00", endTime: "17:00", isUnavailable: false },
  saturday:  { startTime: "09:00", endTime: "17:00", isUnavailable: true },
  sunday:    { startTime: "09:00", endTime: "17:00", isUnavailable: true },
};

export default function PreferencesPage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [workingHours, setWorkingHours] = useState<WorkingHours>(initialWorkingHours);
  const [isSaving, setIsSaving] = useState(false); // For future Firebase save

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
    // TODO: Load preferences from Firebase when component mounts
  }, [currentUser, authLoading, router]);

  const handleTimeChange = (day: DayOfWeek, type: 'startTime' | 'endTime', value: string) => {
    setWorkingHours(prev => {
      const newHours = { ...prev, [day]: { ...prev[day], [type]: value } };
      // Basic validation: ensure end time is after start time
      if (type === 'startTime' && newHours[day].endTime < value) {
        newHours[day].endTime = value;
      }
      if (type === 'endTime' && newHours[day].startTime > value) {
        newHours[day].startTime = value;
      }
      return newHours;
    });
  };

  const handleUnavailableChange = (day: DayOfWeek, checked: boolean) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], isUnavailable: checked },
    }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    console.log("Saving preferences:", workingHours);
    // TODO: Implement Firebase save logic here
    // Example: await saveWorkingHoursToFirebase(currentUser.uid, workingHours);
    toast({
      title: "Preferences Saved (Simulated)",
      description: "Your working hours have been logged to console. Firebase saving to be implemented.",
    });
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
  };
  
  const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

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
            <p className="mt-4 text-muted-foreground">Loading preferences...</p>
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
        <div className="container max-w-3xl mx-auto space-y-8">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold flex items-center text-primary">
                <Settings className="mr-2 h-6 w-6" /> Manage Preferences
              </CardTitle>
              <CardDescription>
                Adjust your application settings and preferences here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                General preference management features will be available here in a future update.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center">
                <Clock className="mr-2 h-5 w-5 text-primary" /> Working Hours
              </CardTitle>
              <CardDescription>
                Set your available working hours for each day. These will affect the time slots shown on booking forms.
                Mark a day as unavailable to block it entirely on the public booking calendar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {daysOfWeek.map((day) => (
                <div key={day} className="grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr_auto] items-center gap-3 p-3 border rounded-md bg-muted/20">
                  <Label htmlFor={`${day}-unavailable`} className="font-medium text-sm sm:text-base col-span-1 sm:col-span-1">
                    {capitalizeFirstLetter(day)}
                  </Label>
                  
                  <div className="grid grid-cols-2 gap-3 col-span-1 sm:col-span-2">
                    <div>
                      <Label htmlFor={`${day}-startTime`} className="text-xs text-muted-foreground">Start Time</Label>
                      <Select
                        value={workingHours[day].startTime}
                        onValueChange={(value) => handleTimeChange(day, 'startTime', value)}
                        disabled={workingHours[day].isUnavailable || isSaving}
                      >
                        <SelectTrigger id={`${day}-startTime`} className="w-full mt-1">
                          <SelectValue placeholder="Start time" />
                        </SelectTrigger>
                        <SelectContent>
                          {allTimeSlots.map(slot => (
                            <SelectItem key={`${day}-start-${slot}`} value={slot} disabled={slot >= workingHours[day].endTime && workingHours[day].endTime !== "00:00"}>
                              {slot}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`${day}-endTime`} className="text-xs text-muted-foreground">End Time</Label>
                      <Select
                        value={workingHours[day].endTime}
                        onValueChange={(value) => handleTimeChange(day, 'endTime', value)}
                        disabled={workingHours[day].isUnavailable || isSaving}
                      >
                        <SelectTrigger id={`${day}-endTime`} className="w-full mt-1">
                          <SelectValue placeholder="End time" />
                        </SelectTrigger>
                        <SelectContent>
                          {allTimeSlots.map(slot => (
                            <SelectItem key={`${day}-end-${slot}`} value={slot} disabled={slot <= workingHours[day].startTime && workingHours[day].startTime !== "00:00"}>
                              {slot}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 justify-self-start sm:justify-self-end pt-2 sm:pt-0 col-span-1 sm:col-span-1">
                    <Checkbox
                      id={`${day}-unavailable`}
                      checked={workingHours[day].isUnavailable}
                      onCheckedChange={(checked) => handleUnavailableChange(day, !!checked)}
                      disabled={isSaving}
                    />
                    <Label htmlFor={`${day}-unavailable`} className="text-xs sm:text-sm text-muted-foreground flex items-center">
                      <Ban className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> Unavailable
                    </Label>
                  </div>
                </div>
              ))}
              <div className="flex justify-end mt-6">
                <Button onClick={handleSaveChanges} disabled={isSaving}>
                  {isSaving ? (
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
      <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">
        © {new Date().getFullYear()} ServiceBooker Pro. All rights reserved.
      </footer>
    </div>
  );
}
