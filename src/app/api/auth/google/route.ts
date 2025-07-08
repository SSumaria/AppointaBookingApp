
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
    // This is INSECURE for production. In a real app, you would verify a session
    // or an ID token to get the userId, not trust a query parameter.
    // This approach is for demonstration purposes within this environment.
    const { searchParams, origin } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Dynamically construct the redirectURI from the request's origin.
    // This is more robust than relying on an environment variable.
    const redirectURI = `${origin}/api/auth/google/callback`;

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectURI
    );

    const SCOPES = ['https://www.googleapis.com/auth/calendar'];

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', // Important to get a refresh token
        scope: SCOPES,
        prompt: 'consent', // Force consent screen to ensure we get a refresh token, even on re-auth
        state: userId, // Pass the user ID to the callback so we know who to associate the tokens with
    });

    return NextResponse.redirect(authUrl);
}
