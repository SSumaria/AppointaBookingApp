import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebaseConfig';

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const { searchParams } = url;
    const code = searchParams.get('code');
    const encodedState = searchParams.get('state');
    const error = searchParams.get('error');

    // This is the URI for the token exchange. It must exactly match the URI
    // used in the initial authorization request. We derive it from the request's
    // own URL to ensure it's always correct, even behind proxies.
    const tokenExchangeRedirectUri = `${url.origin}${url.pathname}`;
    
    // Diagnostic log
    console.log(`[Google Auth Callback] Using tokenExchangeRedirectUri: ${tokenExchangeRedirectUri}`);

    let userId: string;

    try {
        if (!encodedState) throw new Error('State parameter is missing.');
        const stateJSON = Buffer.from(encodedState, 'base64').toString('utf8');
        const state = JSON.parse(stateJSON);
        if (!state.userId) throw new Error('Invalid state object: missing userId.');
        userId = state.userId;
    } catch (e: any) {
        console.error("Failed to parse state parameter:", e.message);
        const fallbackErrorRedirect = `/preferences?status=error&message=${encodeURIComponent('Invalid state parameter in callback.')}`;
        return NextResponse.redirect(new URL(fallbackErrorRedirect, url.origin));
    }
    
    // These are now relative paths. They will resolve against the current origin of this callback route.
    const finalSuccessRedirect = `/preferences?status=success`;
    const finalErrorRedirect = (msg: string) => `/preferences?status=error&message=${encodeURIComponent(msg)}`;

    if (error) {
        console.error('Google OAuth Error:', error);
        return NextResponse.redirect(new URL(finalErrorRedirect(error), url.origin));
    }

    if (!code) {
        const errorMessage = 'Missing authorization code from Google. Cannot complete connection.';
        console.error(errorMessage);
        return NextResponse.redirect(new URL(finalErrorRedirect(errorMessage), url.origin));
    }

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      tokenExchangeRedirectUri // Use the derived URI for the token exchange
    );

    try {
        const { tokens } = await oAuth2Client.getToken(code);
        
        if (!tokens.refresh_token) {
            console.warn("Refresh token was not received. This can happen on re-authentication without 'prompt: consent'. The connection will work short-term but may require re-authentication later.");
        }

        const userPreferencesRef = ref(db, `UserPreferences/${userId}/googleCalendar`);
        await set(userPreferencesRef, {
            integrated: true,
            tokens: tokens,
        });

        console.log(`Successfully stored Google Calendar tokens for user ${userId}`);
        // Now redirect to the final destination. Since we removed origin from state,
        // this will redirect relative to the callback's origin (e.g., the 9000-... domain),
        // which will break the login state but allows us to test the Google API call itself.
        return NextResponse.redirect(new URL(finalSuccessRedirect, url.origin));

    } catch (err: any) {
        console.error('Error exchanging token or saving to database:', err);
        const errorMessage = err.response?.data?.error_description || err.message || 'Token exchange failed.';
        return NextResponse.redirect(new URL(finalErrorRedirect(errorMessage), url.origin));
    }
}
