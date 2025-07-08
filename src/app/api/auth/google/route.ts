
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');

    if (!state) {
        return new NextResponse("State parameter is missing from the request.", { status: 400 });
    }
    
    // This is the server-side API route that Google will call back to.
    const redirectURI = `${new URL(request.url).origin}/api/auth/google/callback`;

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectURI
    );

    const SCOPES = ['https://www.googleapis.com/auth/calendar'];

    // We pass the state we received from the client directly to Google.
    // Google will then pass it back to our callback URI.
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', // Request a refresh token
        prompt: 'consent',      // Force consent screen to ensure refresh token is issued
        scope: SCOPES,
        state: state,
    });

    return NextResponse.redirect(authUrl);
}
