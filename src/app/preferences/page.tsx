
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Settings, Clock, Ban, Loader2, Moon, Sun, CalendarDays, XCircle } from "lucide-react";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format, addMinutes, parse } from 'date-fns';
import { Switch } from "@/components/ui/switch";

// Firebase imports
import { ref, set, get } from "firebase/database";
import { db } from '@/lib/firebaseConfig';

const generateFullDayTimeSlots = () => {
  const slots = [];
  let currentTime = new Date();
  currentTime.setHours(0, 0, 0, 0); 

  const endTimeLimit = new Date();
  endTimeLimit.setHours(23, 59, 0, 0);

  while (currentTime <= endTimeLimit) {
    slots.push(format(currentTime, "HH:mm"));
    currentTime = addMinutes(currentTime, 30);
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

export type WorkingHours = Record<DayOfWeek, DaySetting>;

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
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [workingHours, setWorkingHours] = useState<WorkingHours>(initialWorkingHours);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);

  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const isVerifying = searchParams.get('status') === 'success';

  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setIsDarkMode(localStorage.getItem('darkMode') === 'true');
  }, []);

  useEffect(() => {
    if (isClient) {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('darkMode', 'true');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('darkMode', 'false');
      }
    }
  }, [isDarkMode, isClient]);

  const handleDarkModeToggle = (checked: boolean) => {
    setIsDarkMode(checked);
  };

  const fetchUserPreferences = useCallback(async (userId: string) => {
    if (!db) {
        toast({ title: "Error", description: "Database connection not available.", variant: "destructive" });
        setIsLoadingPreferences(false);
        return;
    }
    setIsLoadingPreferences(true);
    try {
      const preferencesRef = ref(db, `UserPreferences/${userId}/workingHours`);
      const snapshot = await get(preferencesRef);
      if (snapshot.exists()) {
        const loadedPreferences = snapshot.val() as WorkingHours;
        let isValid = true;
        daysOfWeek.forEach(day => {
            if (!loadedPreferences[day] || typeof loadedPreferences[day].startTime !== 'string' || typeof loadedPreferences[day].endTime !== 'string' || typeof loadedPreferences[day].isUnavailable !== 'boolean') {
                isValid = false;
            }
        });
        if(isValid) {
            setWorkingHours(loadedPreferences);
        } else {
            setWorkingHours(initialWorkingHours); 
        }
      }
    } catch (error: any) {
      console.error("Error fetching user preferences:", error);
      toast({ title: "Error Loading Preferences", description: error.message || "Could not load your saved working hours.", variant: "destructive" });
    } finally {
      setIsLoadingPreferences(false);
    }
  }, [toast]);

  const checkCalendarConnection = useCallback(async (userId: string) => {
    setIsCheckingConnection(true);
    try {
        const calendarPrefRef = ref(db, `UserPreferences/${userId}/googleCalendar`);
        const snapshot = await get(calendarPrefRef);
        const isConnected = snapshot.exists() && snapshot.val()?.integrated === true;
        setIsCalendarConnected(isConnected);
    } catch (error) {
        console.error("Error checking calendar connection status:", error);
        setIsCalendarConnected(false);
    } finally {
        setIsCheckingConnection(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!currentUser) {
      router.push('/login');
      return;
    }
    
    const status = searchParams.get('status');
    const message = searchParams.get('message');
    
    if (status === 'error') {
      toast({ title: "Connection Failed", description: message || "An unknown error occurred.", variant: "destructive", duration: 10000 });
      router.replace('/preferences', { scroll: false }); 
      checkCalendarConnection(currentUser.uid); 
    } else if (status === 'success') {
      toast({ title: "Success!", description: "Verifying calendar connection..." });
      setTimeout(() => {
        checkCalendarConnection(currentUser.uid).then(() => {
           router.replace('/preferences', { scroll: false }); 
        });
      }, 1500); 
    } else {
      checkCalendarConnection(currentUser.uid);
    }
    
    fetchUserPreferences(currentUser.uid);

  }, [currentUser, authLoading, router, searchParams, toast, checkCalendarConnection, fetchUserPreferences]);

  const handleConnectCalendar = () => {
    if (!currentUser) {
        toast({ title: "Not Logged In", description: "You must be logged in to connect your calendar.", variant: "destructive" });
        return;
    }
    
    // The server will determine the redirect URI. We only need to pass the userId.
    const statePayload = {
      userId: currentUser.uid,
    };
    const state = btoa(JSON.stringify(statePayload));
    window.location.href = `/api/auth/google?state=${encodeURIComponent(state)}`;
  };

  const handleDisconnectCalendar = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/auth/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.uid })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to disconnect');
      
      toast({ title: "Success", description: "Google Calendar has been disconnected." });
      setIsCalendarConnected(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTimeChange = (day: DayOfWeek, type: 'startTime' | 'endTime', value: string) => {
    setWorkingHours(prev => {
      const newHours = { ...prev, [day]: { ...prev[day], [type]: value } };
      const currentStartTime = parse(newHours[day].startTime, "HH:mm", new Date());
      const currentEndTime = parse(newHours[day].endTime, "HH:mm", new Date());

      if (type === 'startTime' && currentEndTime <= currentStartTime) {
        newHours[day].endTime = value; 
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
    if (!currentUser?.uid) return;
    
    for (const day of daysOfWeek) {
        const { startTime, endTime, isUnavailable } = workingHours[day];
        if (!isUnavailable) {
            const parsedStart = parse(startTime, "HH:mm", new Date());
            const parsedEnd = parse(endTime, "HH:mm", new Date());
            if (parsedEnd <= parsedStart) {
                toast({ title: "Invalid Time Range", description: `For ${capitalizeFirstLetter(day)}, end time must be after start time.`, variant: "destructive" });
                return;
            }
        }
    }

    setIsSaving(true);
    try {
      const preferencesRef = ref(db, `UserPreferences/${currentUser.uid}/workingHours`);
      await set(preferencesRef, workingHours);
      toast({ title: "Preferences Saved", description: "Your working hours have been successfully saved." });
    } catch (error: any) {
      console.error("Error saving user preferences:", error);
      toast({ title: "Error Saving Preferences", description: error.message || "Could not save your working hours.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  const capitalizeFirstLetter = (string: string) => string.charAt(0).toUpperCase() + string.slice(1);

  if (authLoading || (!currentUser && !authLoading) || (isLoadingPreferences && !currentUser)) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="animate-spin mx-auto h-12 w-12 text-primary" />
            <p className="mt-4 text-muted-foreground">
              {authLoading ? "Authenticating..." : "Loading preferences..."}
            </p>
          </div>
        </main>
        <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">© {new Date().getFullYear()} Appointa.</footer>
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
              <CardTitle className="text-2xl font-bold flex items-center text-primary"><Settings className="mr-2 h-6 w-6" /> Manage Preferences</CardTitle>
              <CardDescription>Adjust your application settings, integrations, and display options here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div>
                <Label htmlFor="darkModeToggle" className="font-medium flex items-center">{isDarkMode ? <Moon className="mr-2 h-5 w-5" /> : <Sun className="mr-2 h-5 w-5" />} Dark Mode</Label>
                <div className="flex items-center space-x-2 mt-2">
                  <Switch id="darkModeToggle" checked={isDarkMode} onCheckedChange={handleDarkModeToggle} aria-label="Toggle dark mode" />
                  <span className="text-sm text-muted-foreground">Enable to switch to a darker color theme.</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-xl">
            <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center"><CalendarDays className="mr-2 h-5 w-5 text-primary" /> Integrations</CardTitle>
                <CardDescription>Connect your account to third-party services like Google Calendar.</CardDescription>
            </CardHeader>
            <CardContent>
                {isCheckingConnection || isVerifying ? (
                    <div className="flex items-center space-x-2 p-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /><span className="text-muted-foreground">{isVerifying ? "Verifying new connection..." : "Checking connection status..."}</span></div>
                ) : (
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-full"><CalendarDays className="h-6 w-6 text-primary"/></div>
                            <div>
                                <h3 className="font-semibold">Google Calendar</h3>
                                <p className="text-sm text-muted-foreground">{isCalendarConnected ? "Syncs appointments automatically." : "Connect to sync your bookings."}</p>
                            </div>
                        </div>
                        {isCalendarConnected ? (
                            <Button variant="destructive" onClick={handleDisconnectCalendar} disabled={isSaving}><XCircle className="mr-2 h-4 w-4"/> Disconnect</Button>
                        ) : (
                            <Button onClick={handleConnectCalendar}>Connect</Button>
                        )}
                    </div>
                )}
            </CardContent>
          </Card>

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center"><Clock className="mr-2 h-5 w-5 text-primary" /> Working Hours</CardTitle>
              <CardDescription>Set your available working hours for each day. These will affect the time slots shown on booking forms.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingPreferences && currentUser ? (
                <div className="text-center py-6"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /><p className="mt-2 text-muted-foreground">Loading working hours settings...</p></div>
              ) : (
                <>
                  {daysOfWeek.map((day) => (
                    <div key={day} className="grid grid-cols-1 sm:grid-cols-[100px_1fr_1fr_auto] items-center gap-3 p-3 border rounded-md bg-muted/20 dark:bg-background/30">
                      <Label htmlFor={`${day}-unavailable`} className="font-medium text-sm sm:text-base col-span-1 sm:col-span-1">{capitalizeFirstLetter(day)}</Label>
                      <div className="grid grid-cols-2 gap-3 col-span-1 sm:col-span-2">
                        <div>
                          <Label htmlFor={`${day}-startTime`} className="text-xs text-muted-foreground">Start Time</Label>
                          <Select value={workingHours[day].startTime} onValueChange={(value) => handleTimeChange(day, 'startTime', value)} disabled={workingHours[day].isUnavailable || isSaving || isLoadingPreferences}>
                            <SelectTrigger id={`${day}-startTime`} className="w-full mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {allTimeSlots.map(slot => (<SelectItem key={`${day}-start-${slot}`} value={slot}>{slot}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`${day}-endTime`} className="text-xs text-muted-foreground">End Time</Label>
                          <Select value={workingHours[day].endTime} onValueChange={(value) => handleTimeChange(day, 'endTime', value)} disabled={workingHours[day].isUnavailable || isSaving || isLoadingPreferences}>
                            <SelectTrigger id={`${day}-endTime`} className="w-full mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {allTimeSlots.map(slot => (<SelectItem key={`${day}-end-${slot}`} value={slot} disabled={!workingHours[day].isUnavailable && slot <= workingHours[day].startTime && workingHours[day].startTime !== "00:00"}>{slot}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 justify-self-start sm:justify-self-end pt-2 sm:pt-0 col-span-1 sm:col-span-1">
                        <Checkbox id={`${day}-unavailable`} checked={workingHours[day].isUnavailable} onCheckedChange={(checked) => handleUnavailableChange(day, !!checked)} disabled={isSaving || isLoadingPreferences} />
                        <Label htmlFor={`${day}-unavailable`} className="text-xs sm:text-sm text-muted-foreground flex items-center"><Ban className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> Unavailable</Label>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end mt-6">
                    <Button onClick={handleSaveChanges} disabled={isSaving || isLoadingPreferences}>{isSaving ? <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" /> : "Save Changes"}</Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">© {new Date().getFullYear()} Appointa.</footer>
    </div>
  );
}

