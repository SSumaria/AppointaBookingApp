
"use client";

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import Image from 'next/image';
import { CalendarPlus, Users, Share2, ArrowRight } from "lucide-react";

export default function LandingPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && currentUser) {
      router.push('/dashboard');
    }
  }, [currentUser, loading, router]);
  
  if (loading || currentUser) {
     return (
        <div className="min-h-screen flex flex-col">
            <main className="flex-grow flex items-center justify-center">
                <div className="text-center">
                    <svg className="animate-spin mx-auto h-12 w-12 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-muted-foreground">Loading...</p>
                </div>
            </main>
        </div>
    );
  }


  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-20 sm:py-32">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold text-primary mb-4 tracking-tight">
              Effortless Appointment Scheduling
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Apointa simplifies your booking process, manages your client relationships, and gives you back your time. Focus on your service, not your schedule.
            </p>
            <div className="flex justify-center items-center gap-4">
              <Link href="/register">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">Get Started for Free <ArrowRight className="ml-2 h-5 w-5" /></Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline">
                  Login
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-muted/40">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold">Everything You Need to Succeed</h2>
              <p className="text-lg text-muted-foreground mt-2">Powerful features to streamline your business.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-8 bg-card rounded-lg shadow-lg">
                <div className="flex justify-center items-center mb-4">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <CalendarPlus className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">Intuitive Booking</h3>
                <p className="text-muted-foreground">Quickly create, view, and manage all your appointments from a powerful, centralized calendar and dashboard.</p>
              </div>
              <div className="text-center p-8 bg-card rounded-lg shadow-lg">
                <div className="flex justify-center items-center mb-4">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">Client Management</h3>
                <p className="text-muted-foreground">Keep detailed records of all your clients, including their contact information and complete appointment history.</p>
              </div>
              <div className="text-center p-8 bg-card rounded-lg shadow-lg">
                <div className="flex justify-center items-center mb-4">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <Share2 className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">Public Booking Page</h3>
                <p className="text-muted-foreground">Share a personal link with your clients, allowing them to book appointments with you directly based on your availability.</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* Image Feature Section */}
        <section className="py-20">
          <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
            <div className="prose lg:prose-lg dark:prose-invert">
                <h2 className="text-3xl font-bold text-primary">Your Business, Your Schedule</h2>
                <p className="text-muted-foreground">
                    Stop the back-and-forth emails. Apointa provides a clean, professional booking page you can share anywhere. Clients see your real-time availability and can book a slot in seconds.
                </p>
                <ul>
                    <li>Set custom working hours for each day.</li>
                    <li>Bookings automatically block out your calendar.</li>
                    <li>Reduce no-shows with a clear, confirmed schedule.</li>
                </ul>
            </div>
             <div>
               <Image 
                 src="https://placehold.co/600x400.png" 
                 alt="Apointa public booking page screenshot" 
                 width={600} 
                 height={400} 
                 className="rounded-lg shadow-2xl"
                 data-ai-hint="online booking"
                />
             </div>
          </div>
        </section>


        {/* Call to Action Section */}
        <section className="py-20 bg-muted/40">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Simplify Your Business?</h2>
            <p className="text-lg text-muted-foreground mb-8">Join today and take control of your appointments.</p>
            <Link href="/register">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                Sign Up Now
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <footer className="bg-background py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Apointa. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
