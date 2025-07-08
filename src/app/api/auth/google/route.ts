
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Dynamically construct the redirect URI from request headers
    const proto = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    if (!host) {
        return NextResponse.json({ error: 'Could not determine host from request headers' }, { status: 500 });
    }
    const redirectURI = `${proto}://${host}/api/auth/google/callback`;
    const origin = `${proto}://${host}`; // The origin we want to return to.

    // Encode both userId and the original origin into the state parameter
    const state = Buffer.from(JSON.stringify({ userId, origin })).toString('base64');

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectURI
    );

    const SCOPES = ['https://www.googleapis.com/auth/calendar'];

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        state: state, // Use the encoded state
    });

    return NextResponse.redirect(authUrl);
}
