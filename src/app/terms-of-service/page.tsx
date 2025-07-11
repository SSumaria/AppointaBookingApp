"use client";

import React from 'react';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function TermsOfServicePage() {
    const { currentUser, loading } = useAuth();
    const router = useRouter();
    const [effectiveDate, setEffectiveDate] = React.useState('');

    React.useEffect(() => {
        // This ensures the date is rendered only on the client-side to avoid hydration mismatches.
        setEffectiveDate(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
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
              <CardTitle className="text-3xl font-bold text-primary">Terms of Service for Appointa</CardTitle>
              <CardDescription>Effective Date: {effectiveDate || 'Loading...'}</CardDescription>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none text-foreground/90">
              <h2>1. Acceptance of Terms</h2>
              <p>
                By creating an account and using the Appointa application ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of the terms, then you may not access the Service.
              </p>

              <h2>2. User Accounts</h2>
              <p>
                You are responsible for safeguarding your account credentials and for all activities that occur under your account. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
              </p>

              <h2>3. User Responsibilities</h2>
              <ul>
                <li>You agree to use the Service only for lawful purposes.</li>
                <li>You are solely responsible for the accuracy and legality of the client and appointment information you enter into the Service.</li>
                <li>You agree not to use the service to store or transmit any material that is infringing, libelous, or otherwise unlawful or tortious.</li>
              </ul>

              <h2>4. Service Provision and Limitations</h2>
              <p>
                The Service is provided on an "as is" and "as available" basis. While we strive for high availability, we do not warrant that the service will be uninterrupted, timely, secure, or error-free.
              </p>

              <h2>5. Intellectual Property</h2>
              <p>
                The Service and its original content, features, and functionality (including but not limited to all information, software, text, displays, images, video, and audio, and the design thereof) are owned by the Service's creators and are protected by international copyright and other intellectual property laws. The data you enter (your client list, appointment details, etc.) remains your property.
              </p>

              <h2>6. Termination</h2>
              <p>
                We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
              </p>

              <h2>7. Limitation of Liability</h2>
              <p>
                In no event shall the Service provider be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
              </p>

              <h2>8. Changes to Terms</h2>
              <p>
                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any changes by posting the new Terms on this page. Your continued use of the Service after any such changes constitutes your acceptance of the new Terms.
              </p>

              <h2>9. Contact Us</h2>
                <p>
                    If you have any questions about these Terms, please contact the administrator of this application.
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
