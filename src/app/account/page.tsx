
"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, Mail, Loader2 } from "lucide-react";

export default function AccountPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, loading, router]);

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="animate-spin mx-auto h-12 w-12 text-primary" />
            <p className="mt-4 text-muted-foreground">Loading account details...</p>
          </div>
        </main>
        <footer className="bg-background py-4 text-center text-sm text-muted-foreground mt-auto">
          © {new Date().getFullYear()} Appointa. All rights reserved.
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow py-10">
        <div className="container max-w-2xl mx-auto">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold flex items-center text-primary">
                <User className="mr-3 h-6 w-6" /> My Account
              </CardTitle>
              <CardDescription>
                View your account details below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center space-x-3 p-4 border rounded-md">
                <User className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-semibold">{currentUser.displayName || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-4 border rounded-md">
                <Mail className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email Address</p>
                  <p className="font-semibold">{currentUser.email}</p>
                </div>
              </div>
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
