
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Lock, LogIn } from 'lucide-react';
import Header from '@/components/layout/Header';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signInWithEmail, signInWithGoogle, currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (currentUser) {
      router.push('/dashboard'); // Redirect if already logged in
    }
  }, [currentUser, router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
        // Toast handled by AuthContext
        return;
    }
    await signInWithEmail(email, password);
  };

  const handleGoogleLogin = async () => {
    await signInWithGoogle();
  };

  if (currentUser) return null; // Avoid rendering form if redirecting

  return (
    <div className="min-h-screen flex flex-col bg-muted/40">
      <Header />
      <main className="flex-grow flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-primary">Login to Appointa</CardTitle>
            <CardDescription>Access your account to manage bookings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                 <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="pl-10"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading}>
                {loading ? (
                   <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <LogIn className="mr-2 h-5 w-5" />
                )}
                Login
              </Button>
            </form>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full rounded-md ring-offset-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <Image
                src="/Sign in with google.png"
                width={380}
                height={40}
                alt="Sign in with Google"
                className="w-full h-auto"
              />
            </button>
          </CardContent>
          <CardFooter className="text-center text-sm">
            <p className="w-full">
              Don't have an account?{' '}
              <Link href="/register" className="font-medium text-primary hover:underline">
                Register here
              </Link>
            </p>
          </CardFooter>
        </Card>
      </main>
      <footer className="bg-background py-4 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Appointa. All rights reserved.
      </footer>
    </div>
  );
}
