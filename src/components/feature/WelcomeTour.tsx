
"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Calendar, Share2, Clock, StickyNote } from 'lucide-react';

interface TourStep {
    icon: React.ElementType;
    title: string;
    description: string;
    imageSrc: string;
    imageAlt: string;
}

const tourSteps: TourStep[] = [
    {
        icon: Calendar,
        title: "Sync with Google Calendar",
        description: "Connect your Google Calendar to see your Appointa bookings alongside your personal events. Prevent double-bookings and manage your entire schedule in one place. Find this in Manage Preferences.",
        imageSrc: "/images/tour/tour-google-calendar.png",
        imageAlt: "A screenshot of the 'Manage Preferences' page showing the Google Calendar integration card.",
    },
    {
        icon: Share2,
        title: "Your Public Booking Form",
        description: "Get a personal, shareable link that you can send to clients. They can see your live availability and book appointments directly, eliminating the back-and-forth.",
        imageSrc: "/images/tour/tour-public-booking.png",
        imageAlt: "A screenshot of the public booking page that clients use to schedule appointments.",
    },
    {
        icon: Clock,
        title: "Set Your Working Hours",
        description: "Define your availability for each day of the week. Your public booking page will only show slots within these hours, giving you full control over your schedule.",
        imageSrc: "/images/tour/tour-working-hours.png",
        imageAlt: "A screenshot of the 'Working Hours' section in preferences, showing time selectors for each day.",
    },
    {
        icon: StickyNote,
        title: "Keep Detailed Client Notes",
        description: "Add notes to any booking to remember important details. All notes for a client are compiled on their dedicated client page, giving you a complete history at a glance.",
        imageSrc: "/images/tour/tour-client-notes.png",
        imageAlt: "A screenshot of the 'Manage Notes' dialog open for a booking, showing how to add notes.",
    },
];

interface WelcomeTourProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onFinish: () => void;
}

export default function WelcomeTour({ isOpen, onOpenChange, onFinish }: WelcomeTourProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const totalSteps = tourSteps.length;

    const handleNext = () => {
        if (currentStep < totalSteps - 1) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleFinish = () => {
        onFinish();
        onOpenChange(false);
    };

    const { icon: Icon, title, description, imageSrc, imageAlt } = tourSteps[currentStep];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg p-0" onPointerDownOutside={(e) => e.preventDefault()}>
                <div className="relative h-60 w-full">
                    <Image
                        src={imageSrc}
                        alt={imageAlt}
                        layout="fill"
                        objectFit="cover"
                        className="rounded-t-lg"
                        data-ai-hint="abstract technology"
                    />
                </div>
                <DialogHeader className="p-6">
                    <DialogTitle className="flex items-center text-2xl">
                        <Icon className="mr-3 h-7 w-7 text-primary" />
                        {title}
                    </DialogTitle>
                    <DialogDescription className="pt-2 text-base">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex justify-between items-center p-6 bg-muted/50 rounded-b-lg">
                    <div className="text-sm text-muted-foreground">
                        Step {currentStep + 1} of {totalSteps}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handlePrev} disabled={currentStep === 0}>
                            <ArrowLeft className="mr-1 h-4 w-4" /> Previous
                        </Button>
                        {currentStep < totalSteps - 1 ? (
                            <Button onClick={handleNext}>
                                Next <ArrowRight className="ml-1 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button onClick={handleFinish} className="bg-accent text-accent-foreground hover:bg-accent/90">
                                Get Started
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
