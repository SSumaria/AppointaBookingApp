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

    const tokenExchangeRedirectUri = `${url.origin}${url.pathname}`;
    
    let userId: string;
    let origin: string;

    try {
        if (!encodedState) throw new Error('State parameter is missing.');
        const stateJSON = Buffer.from(encodedState, 'base64').toString('utf8');
        const state = JSON.parse(stateJSON);
        if (!state.userId) throw new Error('Invalid state object: missing userId.');
        if (!state.origin) throw new Error('Invalid state object: missing origin.');
        userId = state.userId;
        origin = state.origin;
    } catch (e: any) {
        console.error("Failed to parse state parameter:", e.message);
        // A generic error page is better than a broken redirect loop
        return new NextResponse(`Authentication Error: Invalid state parameter. Please try connecting again from the preferences page.`, { status: 400 });
    }
    
    const finalSuccessRedirect = `${origin}/preferences?status=success`;
    const finalErrorRedirect = (msg: string) => `${origin}/preferences?status=error&message=${encodeURIComponent(msg)}`;

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
            // This is not a fatal error for this session, but the user may need to re-auth later.
            console.warn("Refresh token was not received. This can happen on re-authentication. The connection will work short-term.");
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
