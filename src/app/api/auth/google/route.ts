
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
    const { searchParams, origin: requestOrigin } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }
    
    const redirectURI = `${requestOrigin}/api/auth/google/callback`;

    // State will carry ONLY the userId. The origin will be handled by a relative redirect.
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectURI
    );

    const SCOPES = ['https://www.googleapis.com/auth/calendar'];

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline', // Requesting offline access to get a refresh token
        prompt: 'consent',      // Force consent screen to ensure a refresh token is issued
        scope: SCOPES,
        state: state,
    });

    return NextResponse.redirect(authUrl);
}
