import { NextResponse } from 'next/server';
import { ref, remove } from 'firebase/database';
import { db } from '@/lib/firebaseConfig';
// In a production app with proper session management (e.g., using firebase-admin SDK or NextAuth.js),
// you would verify the user's session on the server instead of trusting the client.
// For this project, we'll trust the userId sent from the authenticated client-side.

export async function POST(request: Request) {
    const { userId } = await request.json();

    if (!userId) {
        return NextResponse.json({ success: false, message: 'User not authenticated' }, { status: 401 });
    }

    try {
        const calendarPrefRef = ref(db, `UserPreferences/${userId}/googleCalendar`);
        await remove(calendarPrefRef);
        
        console.log(`Disconnected Google Calendar for user ${userId}`);
        return NextResponse.json({ success: true, message: 'Successfully disconnected from Google Calendar.' });
    } catch (error: any) {
        console.error(`Error disconnecting Google Calendar for user ${userId}:`, error);
        return NextResponse.json({ success: false, message: 'Failed to disconnect due to a server error.' }, { status: 500 });
    }
}
