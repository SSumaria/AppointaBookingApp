
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebaseConfig';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This should be the userId
    const error = searchParams.get('error');

    // Dynamically construct the base URL for redirection on success/error
    const proto = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    if (!host) {
        // Fallback or handle error if host is not available.
        // For this scenario, a hardcoded fallback might be acceptable, but ideally it should be derived.
        // This response won't be user-facing in case of success, but it's good practice.
        return new Response('Could not determine host from request headers', { status: 500 });
    }
    const origin = `${proto}://${host}`;
    const redirectBaseUrl = `${origin}/preferences`;

    if (error) {
        console.error('Google OAuth Error:', error);
        return NextResponse.redirect(`${redirectBaseUrl}?status=error&message=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
        const errorMessage = 'Missing authorization code or state from Google. Cannot complete connection.';
        console.error(errorMessage);
        return NextResponse.redirect(`${redirectBaseUrl}?status=error&message=${encodeURIComponent(errorMessage)}`);
    }

    const userId = state;
    
    // This URI MUST exactly match the one used in the initial auth request.
    const redirectURI = `${origin}/api/auth/google/callback`;

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectURI
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
        return NextResponse.redirect(`${redirectBaseUrl}?status=success`);

    } catch (err: any) {
        console.error('Error exchanging token or saving to database:', err);
        const errorMessage = err.response?.data?.error_description || err.message || 'Token exchange failed.';
        return NextResponse.redirect(`${redirectBaseUrl}?status=error&message=${encodeURIComponent(errorMessage)}`);
    }
}
