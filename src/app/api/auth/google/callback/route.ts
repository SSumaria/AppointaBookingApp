
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebaseConfig';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const encodedState = searchParams.get('state'); // It's now base64 encoded
    const error = searchParams.get('error');

    // This is the origin of the callback server itself. Used for token exchange.
    const proto = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    if (!host) {
        return new Response('Could not determine host from request headers', { status: 500 });
    }
    const tokenExchangeRedirectUri = `${proto}://${host}/api/auth/google/callback`;

    let finalRedirectBaseUrl: string;
    let userId: string;

    try {
        if (!encodedState) throw new Error('State parameter is missing.');
        const stateJSON = Buffer.from(encodedState, 'base64').toString('utf8');
        const state = JSON.parse(stateJSON);
        if (!state.userId || !state.origin) throw new Error('Invalid state object: missing userId or origin.');

        userId = state.userId;
        finalRedirectBaseUrl = state.origin; // This is the origin we will redirect back to on success/error.
    } catch (e: any) {
        console.error("Failed to parse state parameter:", e.message);
        // Fallback to a safe, generic error page if state is corrupted.
        return new Response(`<html><body><h1>Authentication Error</h1><p>The authentication flow failed due to an invalid state parameter. Please try connecting your calendar again from the preferences page.</p><p>Error: ${e.message}</p></body></html>`, {
            status: 400,
            headers: { 'Content-Type': 'text/html' },
        });
    }
    
    const finalSuccessRedirect = `${finalRedirectBaseUrl}/preferences?status=success`;
    const finalErrorRedirect = (msg: string) => `${finalRedirectBaseUrl}/preferences?status=error&message=${encodeURIComponent(msg)}`;


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
      tokenExchangeRedirectUri // Use the callback's own URI for the token exchange
    );

    try {
        const { tokens } = await oAuth2Client.getToken(code);
        
        if (!tokens.refresh_token) {
            console.warn("Refresh token was not received. This can happen if the user has previously granted consent and the 'prompt: consent' parameter was not used. The connection will work, but may require re-authentication later.");
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
