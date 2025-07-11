
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const encodedState = searchParams.get('state');

    if (!encodedState) {
        return new NextResponse("State parameter is missing from the request.", { status: 400 });
    }
    
    let redirectURI: string;
    try {
        const stateJSON = Buffer.from(encodedState, 'base64').toString('utf8');
        const state = JSON.parse(stateJSON);
        if (state.clientOrigin) {
            console.log(`[Google Auth Start] Using clientOrigin from state: ${state.clientOrigin}`);
            redirectURI = `${state.clientOrigin}/api/auth/google/callback`;
        } else {
            throw new Error("clientOrigin not found in state, falling back to headers.");
        }
    } catch (e: any) {
        console.warn(`[Google Auth Start] Could not use clientOrigin from state. Error: ${e.message}. Using header-based logic instead.`);
        const host = request.headers.get('host');
        const protocol = request.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
        redirectURI = `${protocol}://${host}/api/auth/google/callback`;
    }
    
    console.log(`[Google Auth Start] Determined final redirect URI: ${redirectURI}`);

    const oAuth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
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

    
