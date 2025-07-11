
"use client";

import React from 'react';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicyPage() {
    const { currentUser, loading } = useAuth();
    const router = useRouter();
    const [lastUpdated, setLastUpdated] = React.useState('');

    React.useEffect(() => {
        // This ensures the date is rendered only on the client-side to avoid hydration mismatches.
        setLastUpdated(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    }, []);

    // Redirect to dashboard if logged in
    if (!loading && currentUser) {
      router.push('/dashboard');
      return null; // Render nothing while redirecting
    }

    if(loading || currentUser){
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
    <div className="min-h-screen flex flex-col bg-muted/40">
      <Header />
      <main className="flex-grow py-10">
        <div className="container max-w-3xl mx-auto">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-primary">Privacy Policy for Appointa</CardTitle>
              <CardDescription>Last Updated: {lastUpdated || 'Loading...'}</CardDescription>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none text-foreground/90">
              <p>
                Welcome to Appointa. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application.
              </p>

              <h2>1. Information We Collect</h2>
              <p>
                We collect information that you provide directly to us or that we collect automatically when you use our services.
              </p>
              <h4>a. For Service Providers (You)</h4>
                <p>
                    When you create an account, we collect personal information such as your name and email address. If you choose to connect your Google account for authentication or calendar integration, we will also handle your Google user data as described below.
                </p>

              <h4>b. For Your Clients</h4>
                <p>
                    When your clients book an appointment using your public booking link, we collect the information they provide, including their name, email address, and phone number. This information is stored and associated with your account.
                </p>

              <h2>2. How We Use Your Information</h2>
              <p>
                We use the information we collect solely to provide and improve the Appointa service. This includes:
              </p>
              <ul>
                <li>Creating and managing your user account.</li>
                <li>Allowing clients to book appointments with you.</li>
                <li>Enabling you to manage your client list and view appointment history.</li>
                <li>Syncing appointments with your Google Calendar, if you have connected it.</li>
                <li>Sending transactional emails, such as booking confirmations or cancellations.</li>
              </ul>

              <h2>3. Google Calendar Integration</h2>
                <p>
                  If you choose to connect your Google Calendar, our application will access your calendar to provide its core functionality. The use of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy#limited-use-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
                </p>
                <ul>
                    <li>
                        <strong>Access:</strong> We request read and write access to your primary Google Calendar. We do not access any other calendars you may have.
                    </li>
                    <li>
                        <strong>Use:</strong> We use this access exclusively to create, update, and delete calendar events that correspond to the appointments made within the Appointa application. This ensures your Google Calendar stays in sync with your Appointa schedule.
                    </li>
                    <li>
                        <strong>Storage:</strong> To maintain this connection without requiring you to log in repeatedly, we securely store authentication tokens (access and refresh tokens) provided by Google. These tokens are stored in our secure Firebase Realtime Database and are only associated with your user account. We also store the Google Calendar event ID for each synced appointment to manage updates and cancellations.
                    </li>
                    <li>
                        <strong>Sharing:</strong> We do not share your Google user data, including your tokens or calendar event information, with any third parties. The data is used solely for the purpose of the calendar synchronization feature within Appointa.
                    </li>
                </ul>

              <h2>4. Data Sharing</h2>
                <p>
                    Other than the specific use for Google Calendar integration described above, we do not sell, rent, or share your personal data with third-party marketers. Your client information is under your control as the service provider. We will not contact your clients for any reason other than transactional notifications related to their bookings with you.
                </p>

              <h2>5. Data Security</h2>
              <p>
                We take the security of your data seriously. We rely on secure, industry-standard services like Firebase Authentication and Realtime Database, which have built-in security features and rules to help protect user data from unauthorized access.
              </p>
              
              <h2>6. Contact Us</h2>
                <p>
                    If you have any questions or concerns about this Privacy Policy or your data, please contact us at <a href="mailto:shyamsumaria96@gmail.com" className="text-primary hover:underline">shyamsumaria96@gmail.com</a>.
                </p>

              <h2>7. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">
        © {new Date().getFullYear()} Appointa. All rights reserved.
      </footer>
    </div>
  );
}
