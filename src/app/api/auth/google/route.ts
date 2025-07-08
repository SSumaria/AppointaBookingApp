
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
    // This is INSECURE for production. In a real app, you would verify a session
    // or an ID token to get the userId, not trust a query parameter.
    // This approach is for demonstration purposes within this environment.
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // IMPORTANT: This URI MUST exactly match one of the "Authorized redirect URIs"
    // in your Google Cloud Console for the OAuth 2.0 Client ID.
    const redirectURI = 'http://localhost:3000/api/auth/google/callback';

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
