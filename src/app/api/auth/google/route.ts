
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    // Get the origin from the client-side query parameter for reliability
    const clientOrigin = searchParams.get('origin'); 

    if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }
    
    if (!clientOrigin) {
        return NextResponse.json({ error: 'Client origin is missing from the request' }, { status: 400 });
    }

    // This part is for Google's redirect_uri check. It needs the URL of the proxy handling the callback.
    const proto = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    if (!host) {
        return NextResponse.json({ error: 'Could not determine host from request headers' }, { status: 500 });
    }
    const redirectURI = `${proto}://${host}/api/auth/google/callback`;

    // Encode both userId and the *original* client origin into the state parameter
    const state = Buffer.from(JSON.stringify({ userId, origin: clientOrigin })).toString('base64');

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectURI
    );

    const SCOPES = ['https://www.googleapis.com/auth/calendar'];

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        state: state, // The prompt: 'consent' parameter has been removed.
    });

    return NextResponse.redirect(authUrl);
}
