
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebaseConfig';

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const { searchParams } = url;
    const code = searchParams.get('code');
    const encodedState = searchParams.get('state'); // The state we originally sent to Google
    const error = searchParams.get('error');

    // This is the URI for the token exchange step. It must exactly match the one used
    // in the initial `/api/auth/google` route. `url.origin` is the server's origin here.
    const tokenExchangeRedirectUri = `${url.origin}${url.pathname}`;
    
    let userId: string;
    let browserOrigin: string; // To store the user's browser origin (e.g., https://9000-...)

    try {
        if (!encodedState) throw new Error('State parameter is missing.');
        // Decode the state to get our original payload
        const stateJSON = Buffer.from(encodedState, 'base64').toString('utf8');
        const state = JSON.parse(stateJSON);
        if (!state.userId) throw new Error('Invalid state object: missing userId.');
        if (!state.origin) throw new Error('Invalid state object: missing origin.');
        userId = state.userId;
        browserOrigin = state.origin; // This is the key to the correct final redirect
    } catch (e: any) {
        console.error("Failed to parse state parameter:", e.message);
        // We don't have a safe origin to redirect to, so return a simple error response.
        return new NextResponse(`Authentication Error: Invalid state parameter.`, { status: 400 });
    }
    
    // Construct the final redirect URLs using the browser's origin.
    const finalSuccessRedirect = `${browserOrigin}/preferences?status=success`;
    const finalErrorRedirect = (msg: string) => `${browserOrigin}/preferences?status=error&message=${encodeURIComponent(msg)}`;

    if (error) {
        console.error('Google OAuth Error:', error);
        return NextResponse.redirect(finalErrorRedirect(error));
    }

    if (!code) {
        const errorMessage = 'Missing authorization code from Google. Cannot complete connection.';
        console.error(errorMessage);
        return NextResponse.redirect(finalErrorRedirect(errorMessage));
    }

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      tokenExchangeRedirectUri
    );

    try {
        const { tokens } = await oAuth2Client.getToken(code);
        
        if (!tokens.refresh_token) {
            console.warn("Refresh token was not received. This can happen on re-authentication.");
        }

        const userPreferencesRef = ref(db, `UserPreferences/${userId}/googleCalendar`);
        await set(userPreferencesRef, {
            integrated: true,
            tokens: tokens,
        });

        console.log(`Successfully stored Google Calendar tokens for user ${userId}`);
        return NextResponse.redirect(finalSuccessRedirect);

    } catch (err: any) {
        console.error('Error exchanging token or saving to database:', err);
        const errorMessage = err.response?.data?.error_description || err.message || 'Token exchange failed.';
        return NextResponse.redirect(finalErrorRedirect(errorMessage));
    }
}

    