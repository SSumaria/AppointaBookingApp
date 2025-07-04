
"use client";

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import Header from '@/components/layout/Header';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { CalendarPlus, Users, Share2, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Helper component for animations
const AnimatedSection = ({ children, delay = 0, initialClasses = "opacity-0 translate-y-8" }: { children: React.ReactNode, delay?: number, initialClasses?: string }) => {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = ref.current;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                       setIsVisible(true);
                    }, delay);
                    if (element) {
                      observer.unobserve(element);
                    }
                }
            },
            { threshold: 0.1 }
        );

        if (element) {
            observer.observe(element);
        }

        return () => {
            if (element) {
                observer.unobserve(element);
            }
        };
    }, [delay]);

    return (
        <div
            ref={ref}
            className={cn(
                "transition-all duration-700 ease-out",
                isVisible ? "opacity-100 translate-y-0" : initialClasses
            )}
        >
            {children}
        </div>
    );
};


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
            <AnimatedSection>
              <h1 className="text-4xl md:text-6xl font-extrabold text-primary mb-4 tracking-tight">
                Effortless Appointment Scheduling
              </h1>
            </AnimatedSection>
            <AnimatedSection delay={150}>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Appointa is the all-in-one solution for independent professionals and small businesses. Simplify your booking process, manage client relationships with a built-in CRM, and get back your valuable time. Focus on what you do best—we'll handle the schedule.
            </p>
            </AnimatedSection>
            <AnimatedSection delay={300}>
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
            </AnimatedSection>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-muted">
          <div className="container mx-auto px-4">
            <AnimatedSection>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold">A Better Way to Run Your Business</h2>
              <p className="text-lg text-muted-foreground mt-2">Powerful, intuitive features to streamline your operations.</p>
            </div>
            </AnimatedSection>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <AnimatedSection delay={0}>
              <div className="text-center p-8 bg-card rounded-lg shadow-lg h-full">
                <div className="flex justify-center items-center mb-4">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <CalendarPlus className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">Intuitive Booking</h3>
                <p className="text-muted-foreground">A powerful and clear calendar to quickly create, view, and manage all appointments. Color-coded views and multiple layouts (month, week) help you see your schedule at a glance.</p>
              </div>
              </AnimatedSection>
              <AnimatedSection delay={200}>
              <div className="text-center p-8 bg-card rounded-lg shadow-lg h-full">
                <div className="flex justify-center items-center mb-4">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">Client Management</h3>
                <p className="text-muted-foreground">A simple, integrated CRM. Keep detailed records of your clients, including contact info, booking history, and private notes. Search and access client details in seconds.</p>
              </div>
              </AnimatedSection>
              <AnimatedSection delay={400}>
              <div className="text-center p-8 bg-card rounded-lg shadow-lg h-full">
                <div className="flex justify-center items-center mb-4">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <Share2 className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">Public Booking Page</h3>
                <p className="text-muted-foreground">Stop the back-and-forth. Get a personal, shareable link where clients can see your real-time availability and book appointments directly, based on the working hours you set.</p>
              </div>
              </AnimatedSection>
            </div>
          </div>
        </section>
        
        {/* Image Feature Section 1 */}
        <section className="py-20 overflow-x-hidden">
          <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
            <AnimatedSection initialClasses="opacity-0 -translate-x-12">
            <div className="prose lg:prose-lg dark:prose-invert max-w-none">
                <h2 className="text-3xl font-bold text-primary">Your Business, Your Schedule</h2>
                <p className="text-muted-foreground">
                    Stop the back-and-forth emails. Appointa provides a clean, professional booking page you can share anywhere. Clients see your real-time availability and can book a slot in seconds, making scheduling painless for everyone.
                </p>
                <ul className="space-y-2">
                    <li className="flex items-start"><CheckCircle2 className="h-6 w-6 text-green-500 mr-3 mt-1 flex-shrink-0" /><span>Set custom working hours for each day of the week.</span></li>
                    <li className="flex items-start"><CheckCircle2 className="h-6 w-6 text-green-500 mr-3 mt-1 flex-shrink-0" /><span>New bookings automatically block out your calendar to prevent conflicts.</span></li>
                    <li className="flex items-start"><CheckCircle2 className="h-6 w-6 text-green-500 mr-3 mt-1 flex-shrink-0" /><span>Reduce no-shows and confusion with a clear, confirmed schedule.</span></li>
                </ul>
            </div>
            </AnimatedSection>
             <AnimatedSection initialClasses="opacity-0 translate-x-12">
               <Image 
                 src="/images/bookings1.png" 
                 alt="A screenshot of the Appointa public booking page" 
                 width={600} 
                 height={400} 
                 className="rounded-lg shadow-2xl"
                />
             </AnimatedSection>
          </div>
        </section>

        {/* Image Feature Section 2 */}
        <section className="py-20 bg-muted overflow-x-hidden">
          <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
             <AnimatedSection initialClasses="opacity-0 -translate-x-12" delay={200}>
               <Image 
                 src="/images/command-centre2.png" 
                 alt="Appointa dashboard and calendar view" 
                 width={600} 
                 height={400} 
                 className="rounded-lg shadow-2xl"
                />
             </AnimatedSection>
             <AnimatedSection initialClasses="opacity-0 translate-x-12" delay={200}>
                <div className="prose lg:prose-lg dark:prose-invert max-w-none">
                    <h2 className="text-3xl font-bold text-primary">Your Command Center</h2>
                    <p className="text-muted-foreground">
                        Manage your entire business from one place. The Appointa dashboard gives you a complete overview of your appointments, with powerful views and tools to keep you organized and in control.
                    </p>
                    <ul className="space-y-2">
                       <li className="flex items-start"><CheckCircle2 className="h-6 w-6 text-green-500 mr-3 mt-1 flex-shrink-0" /><span>Visualize your schedule with interactive monthly and weekly calendars.</span></li>
                       <li className="flex items-start"><CheckCircle2 className="h-6 w-6 text-green-500 mr-3 mt-1 flex-shrink-0" /><span>Quickly edit, cancel, or add notes to any booking.</span></li>
                       <li className="flex items-start"><CheckCircle2 className="h-6 w-6 text-green-500 mr-3 mt-1 flex-shrink-0" /><span>Filter and view bookings by date to easily find what you're looking for.</span></li>
                    </ul>
                </div>
             </AnimatedSection>
          </div>
        </section>


        {/* Call to Action Section */}
        <section className="py-20">
          <div className="container mx-auto px-4 text-center">
            <AnimatedSection>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Simplify Your Business?</h2>
              <p className="text-lg text-muted-foreground mb-8">Join today and take control of your appointments. It's free to get started.</p>
              <Link href="/register">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                  Sign Up Now
                </Button>
              </Link>
            </AnimatedSection>
          </div>
        </section>
      </main>
      <footer className="bg-background py-6 border-t">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Appointa. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

    