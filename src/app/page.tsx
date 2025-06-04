
"use client";

import Link from 'next/link';
import { Calendar, Clock, Users, ExternalLink } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import Header from '@/components/layout/Header'; 
import { useAuth } from '@/context/AuthContext'; 
import { useRouter } from 'next/navigation'; 
import React, { useState, useEffect } from 'react'; 
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';


export default function HomePage() {
  const { currentUser, loading } = useAuth(); 
  const router = useRouter(); 
  const [publicBookingLink, setPublicBookingLink] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login');
    } else if (currentUser && typeof window !== 'undefined') {
      let originToUse = window.location.origin;
      
      if (window.location.hostname.endsWith('cloudworkstations.dev')) {
        const currentHostname = window.location.hostname;
        const protocol = window.location.protocol; // e.g., "https:"
        
        // Regex to find if the hostname starts with a port prefix like "xxxx-"
        const portPrefixRegex = /^(\d+)-/;
        const portPrefixMatch = currentHostname.match(portPrefixRegex);
        
        let baseHostname = currentHostname;
        if (portPrefixMatch) {
          // If "6000-idx-studio...", baseHostname becomes "idx-studio..."
          baseHostname = currentHostname.substring(portPrefixMatch[0].length);
        }
        
        // Construct the new origin with the "9000-" prefix
        originToUse = `${protocol}//9000-${baseHostname}`;
      }
      
      setPublicBookingLink(`${originToUse}/book/${currentUser.uid}`);
    }
  }, [currentUser, loading, router]);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(publicBookingLink).then(() => {
      toast({
        title: "Link Copied!",
        description: "Your public booking link has been copied to the clipboard.",
      });
    }).catch(err => {
      console.error("Failed to copy link: ", err);
      toast({
        title: "Copy Failed",
        description: "Could not copy the link. Please try again manually.",
        variant: "destructive",
      });
    });
  };

  if (loading || !currentUser) {
    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-grow flex items-center justify-center">
                <div className="text-center">
                    <svg className="animate-spin mx-auto h-12 w-12 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
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
      <main className="flex-grow py-12">
        <div className="container max-w-5xl mx-auto text-center">
          <h1 className="text-4xl font-extrabold text-primary mb-4">
            Welcome to ServiceBooker Pro
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            The easiest way to manage appointments and keep track of your clients.
            {currentUser?.email && <span className="block mt-2 text-sm">Logged in as: {currentUser.email}</span>}
          </p>
          <Link href="/new-booking">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/80 font-bold py-3 px-6 rounded-md">
              Create New Booking →
            </Button>
          </Link>
        </div>

        {publicBookingLink && (
          <div className="container max-w-3xl mx-auto mt-12">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-semibold flex items-center">
                  <ExternalLink className="mr-2 h-5 w-5 text-primary" />
                  Your Public Booking Link
                </CardTitle>
                <CardDescription>
                  Share this link with your clients to allow them to book appointments with you directly.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center space-x-2">
                <Input type="text" value={publicBookingLink} readOnly className="flex-grow" />
                <Button onClick={handleCopyToClipboard} variant="outline">Copy Link</Button>
              </CardContent>
              <CardFooter className="text-xs text-muted-foreground pt-4">
                Anyone with this link can view your available slots and make bookings.
              </CardFooter>
            </Card>
          </div>
        )}

        <div className="container max-w-5xl mx-auto mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 bg-card rounded-lg shadow-lg hover:shadow-xl transition-shadow">
            <Calendar className="h-10 w-10 text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Easy Scheduling</h2>
            <p className="text-sm text-muted-foreground">
              Quickly book appointments with an intuitive scheduling interface.
            </p>
          </div>
          <div className="p-6 bg-card rounded-lg shadow-lg hover:shadow-xl transition-shadow">
            <Clock className="h-10 w-10 text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Time Management</h2>
            <p className="text-sm text-muted-foreground">
              Organize your day efficiently with our booking system.
            </p>
          </div>
          <div className="p-6 bg-card rounded-lg shadow-lg hover:shadow-xl transition-shadow">
            <Users className="h-10 w-10 text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Client Database</h2>
            <p className="text-sm text-muted-foreground">
              Keep track of all your clients and their appointment history.
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">
        © {new Date().getFullYear()} ServiceBooker Pro. All rights reserved.
      </footer>
    </div>
  );
}
