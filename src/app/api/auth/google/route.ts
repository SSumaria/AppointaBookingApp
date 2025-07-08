import { NextResponse, type NextRequest } from 'next/server';
import { oAuth2Client } from '@/lib/googleCalendar';

export async function GET(request: NextRequest) {
    // This is INSECURE for production. In a real app, you would verify a session
    // or an ID token to get the userId, not trust a query parameter.
    // This approach is for demonstration purposes within this environment.
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const SCOPES = ['https://www.googleapis.com/auth/calendar'];

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', // Important to get a refresh token
        scope: SCOPES,
        prompt: 'consent', // Force consent screen to ensure we get a refresh token, even on re-auth
        state: userId, // Pass the user ID to the callback so we know who to associate the tokens with
    });

    return NextResponse.redirect(authUrl);
}
