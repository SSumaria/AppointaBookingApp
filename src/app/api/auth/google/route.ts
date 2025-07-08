
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const encodedState = searchParams.get('state');

    if (!encodedState) {
        return new NextResponse("State parameter is missing from the request.", { status: 400 });
    }
    
    let browserOrigin: string;
    try {
        const stateJSON = Buffer.from(encodedState, 'base64').toString('utf8');
        const state = JSON.parse(stateJSON);
        if (!state.origin) throw new Error('Invalid state object: missing origin.');
        browserOrigin = state.origin;
    } catch (e: any) {
        console.error("Failed to parse state parameter in /api/auth/google:", e.message);
        return new NextResponse("Invalid state parameter.", { status: 400 });
    }

    // Use the browser's origin passed via state to construct the redirect URI
    const redirectURI = `${browserOrigin}/api/auth/google/callback`;

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
        state: encodedState,
    });

    return NextResponse.redirect(authUrl);
}
