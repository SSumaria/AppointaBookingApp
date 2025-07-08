
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
    const { searchParams, origin: requestOrigin } = new URL(request.url);
    const userId = searchParams.get('userId');
    // Get the origin from the client-side query parameter for reliability
    const clientOrigin = searchParams.get('origin'); 

    if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }
    
    if (!clientOrigin) {
        return NextResponse.json({ error: 'Client origin is missing from the request' }, { status: 400 });
    }

    // This is the most reliable way to construct the redirect URI.
    // It uses the origin of the request to this API route itself.
    const redirectURI = `${requestOrigin}/api/auth/google/callback`;

    // Encode both userId and the *original* client origin into the state parameter
    const state = Buffer.from(JSON.stringify({ userId, origin: clientOrigin })).toString('base64');

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectURI
    );

    const SCOPES = ['https://www.googleapis.com/auth/calendar'];

    const authUrl = oAuth2Client.generateAuthUrl({
        // access_type: 'offline', // REMOVED: Requesting offline access can be blocked by policy for unverified apps.
        scope: SCOPES,
        state: state,
    });

    return NextResponse.redirect(authUrl);
}
