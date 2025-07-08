
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
    const { searchParams, origin: requestOrigin } = new URL(request.url);
    const state = searchParams.get('state');

    if (!state) {
        return new NextResponse("State parameter is missing from the request.", { status: 400 });
    }
    
    // The redirectURI is where Google sends the user back to *our server*.
    // This MUST be the API route's own URL. The `requestOrigin` here is the server's origin (e.g., https://9002-...).
    const redirectURI = `${requestOrigin}/api/auth/google/callback`;

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectURI
    );

    const SCOPES = ['https://www.googleapis.com/auth/calendar'];

    // We pass the state we received from the client directly to Google.
    // Google will then pass it back to our callback URI.
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', 
        prompt: 'consent',      
        scope: SCOPES,
        state: state,
    });

    return NextResponse.redirect(authUrl);
}

    