
"use client";

import React, { useState, useEffect } from 'react'; // Added useEffect
import { User } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Header from '@/components/layout/Header'; // Added
import { useAuth } from '@/context/AuthContext'; // Added
import { useRouter } from 'next/navigation'; // Added
import { Icons } from '@/components/icons'; // For SearchIcon

// Firebase imports for Realtime Database
import { ref, get, query as rtQuery, orderByChild, startAt, endAt } from "firebase/database";
import { db } from '@/lib/firebaseConfig';

interface Client {
  id: string; 
  ClientID: string; 
  ClientName: string;
  ClientContact?: string;
  CreateDate: string;
  CreateTime: string;
}

export default function ClientSearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  const { currentUser, loading: authLoading } = useAuth(); // Added
  const router = useRouter(); // Added

  useEffect(() => { // Added
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!currentUser) { // Added check
      toast({
        title: "Authentication Error",
        description: "You must be logged in to search clients.",
        variant: "destructive",
      });
      router.push('/login');
      return;
    }

    if (!searchQuery.trim()) {
      toast({
        title: "Search Error",
        description: "Please enter a client name to search.",
        variant: "destructive",
      });
      setSearchResults([]);
      setHasSearched(true); 
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    if (!db) {
        toast({
            title: "Error",
            description: "Firebase Realtime Database is not initialized.",
            variant: "destructive",
        });
        setIsLoading(false);
        return;
    }

    try {
      const clientsRef = ref(db, 'Clients');
      const clientQuery = rtQuery(
        clientsRef,
        orderByChild('ClientName'),
        startAt(searchQuery),
        endAt(searchQuery + '\uf8ff')
      );

      const snapshot = await get(clientQuery);
      const clients: Client[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const data = childSnapshot.val();
          clients.push({
            id: childSnapshot.key as string,
            ClientID: data.ClientID,
            ClientName: data.ClientName,
            ClientContact: data.ClientContact,
            CreateDate: data.CreateDate,
            CreateTime: data.CreateTime,
          });
        });
      }
      setSearchResults(clients);
      if (clients.length === 0) {
        toast({
          title: "No Results",
          description: "No clients found matching your search.",
        });
      }
    } catch (error: any) {
      console.error("Error searching clients:", error);
      if (error.message && error.message.includes("Permission denied")) {
         toast({
            title: "Permission Denied",
            description: "You do not have permission to search clients. Please log in.",
            variant: "destructive",
        });
      } else {
        toast({
            title: "Search Error",
            description: error.message || "An unexpected error occurred while searching.",
            variant: "destructive",
        });
      }
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !currentUser) { // Added
    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-grow flex items-center justify-center">
                <div className="text-center">
                    <svg className="animate-spin mx-auto h-12 w-12 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-4 text-muted-foreground">Loading client search...</p>
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
      <Header /> {/* Replaced old header */}
      <main className="flex-grow py-10">
        <div className="container max-w-4xl mx-auto">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold flex items-center text-primary">
                <User className="mr-2 h-6 w-6" /> Client Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex items-end space-x-3 mb-8">
                <div className="flex-grow">
                  <Label htmlFor="searchQuery" className="text-sm font-medium">Client Name</Label>
                  <Input
                    type="text"
                    id="searchQuery"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter client name..."
                    className="mt-1"
                  />
                </div>
                <Button type="submit" disabled={isLoading} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {isLoading ? (
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <Icons.search className="mr-2 h-5 w-5" />
                  )}
                  Search
                </Button>
              </form>

              {isLoading && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Loading search results...</p>
                </div>
              )}

              {!isLoading && hasSearched && searchResults.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No clients found matching your criteria.</p>
                </div>
              )}

              {!isLoading && searchResults.length > 0 && (
                <Table>
                  <TableCaption>A list of clients matching your search.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Client Name</TableHead>
                      <TableHead>Client ID</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Date Created</TableHead>
                      <TableHead>Time Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.ClientName}</TableCell>
                        <TableCell>{client.ClientID}</TableCell>
                        <TableCell>{client.ClientContact || 'N/A'}</TableCell>
                        <TableCell>{client.CreateDate}</TableCell>
                        <TableCell>{client.CreateTime}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {!isLoading && !hasSearched && (
                 <div className="text-center py-4 text-muted-foreground">
                    Enter a client name above and click Search to find clients.
                 </div>
              )}
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
