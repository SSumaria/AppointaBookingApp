
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

    // The redirect URI for the token exchange must exactly match the one used
    // in the initial `/api/auth/google` route.
    const tokenExchangeRedirectUri = `${url.origin}/api/auth/google/callback`;
    
    let userId: string;
    let browserOrigin: string;

    try {
        if (!encodedState) throw new Error('State parameter is missing.');
        const stateJSON = Buffer.from(encodedState, 'base64').toString('utf8');
        const state = JSON.parse(stateJSON);
        if (!state.userId) throw new Error('Invalid state object: missing userId.');
        if (!state.origin) throw new Error('Invalid state object: missing origin.');
        userId = state.userId;
        browserOrigin = state.origin;
    } catch (e: any) {
        console.error("Failed to parse state parameter:", e.message);
        const htmlError = `<html><body>Authentication Error: Invalid state parameter. Please try connecting again.</body></html>`;
        return new NextResponse(htmlError, { status: 400, headers: { 'Content-Type': 'text/html' } });
    }
    
    const buildRedirectHtml = (targetUrl: string, message: string) => `
        <!DOCTYPE html>
        <html>
            <head>
                <title>Redirecting...</title>
                <script>
                    window.location.href = "${targetUrl}";
                </script>
            </head>
            <body>
                <p>${message} If you are not redirected automatically, <a href="${targetUrl}">click here</a>.</p>
            </body>
        </html>
    `;

    const finalErrorRedirectUrl = (msg: string) => `${browserOrigin}/preferences?status=error&message=${encodeURIComponent(msg)}`;

    if (error) {
        console.error('Google OAuth Error:', error);
        return new NextResponse(buildRedirectHtml(finalErrorRedirectUrl(error), "Redirecting with error..."), { status: 200, headers: { 'Content-Type': 'text/html' }});
    }

    if (!code) {
        const errorMessage = 'Missing authorization code from Google. Cannot complete connection.';
        console.error(errorMessage);
        return new NextResponse(buildRedirectHtml(finalErrorRedirectUrl(errorMessage), "Redirecting with error..."), { status: 200, headers: { 'Content-Type': 'text/html' }});
    }

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      tokenExchangeRedirectUri
    );

    try {
        const { tokens } = await oAuth2Client.getToken(code);
        
        if (!tokens.refresh_token) {
            console.warn("Refresh token was not received. This can happen on re-authentication. If you need long-term access, you may need to revoke access in your Google account and reconnect.");
        }

        const userPreferencesRef = ref(db, `UserPreferences/${userId}/googleCalendar`);
        await set(userPreferencesRef, {
            integrated: true,
            tokens: tokens,
        });

        console.log(`Successfully stored Google Calendar tokens for user ${userId}`);
        const finalSuccessRedirectUrl = `${browserOrigin}/preferences?status=success`;
        return new NextResponse(buildRedirectHtml(finalSuccessRedirectUrl, "Connection successful! Redirecting..."), { status: 200, headers: { 'Content-Type': 'text/html' } });

    } catch (err: any) {
        console.error('Error exchanging token or saving to database:', err);
        const errorMessage = err.response?.data?.error_description || err.message || 'Token exchange failed.';
        return new NextResponse(buildRedirectHtml(finalErrorRedirectUrl(errorMessage), "Redirecting with error..."), { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
}
