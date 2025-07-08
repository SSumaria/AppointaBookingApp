
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const encodedState = searchParams.get('state');

    if (!encodedState) {
        return new NextResponse("State parameter is missing from the request.", { status: 400 });
    }
    
    // Determine redirect URI from server-side request headers for robustness.
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
    const redirectURI = `${protocol}://${host}/api/auth/google/callback`;

    console.log(`[Google Auth Start] Determined redirect URI: ${redirectURI}`);

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectURI
    );

    const SCOPES = ['https://www.googleapis.com/auth/calendar'];

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
        state: encodedState, // Pass the original state through
    });

    return NextResponse.redirect(authUrl);
}

    