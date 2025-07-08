
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebaseConfig';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const encodedState = searchParams.get('state');
    const error = searchParams.get('error');

    let userId: string;
    let browserOrigin: string;

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
        // We don't have browserOrigin here, so we can't redirect gracefully.
        const htmlError = `<html><body>Authentication Error: Invalid state parameter. Please try connecting again.</body></html>`;
        return new NextResponse(htmlError, { status: 400, headers: { 'Content-Type': 'text/html' } });
    }
    
    // This is the URI Google will redirect back to after authentication. It MUST
    // match one of the URIs registered in your Google Cloud Console project.
    // We derive it from the origin passed in the state to handle proxy/forwarding environments.
    const tokenExchangeRedirectUri = `${browserOrigin}/api/auth/google/callback`;
    
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
        
        // We now request offline access again, so we should get a refresh token on first consent.
        if (!tokens.refresh_token) {
            console.warn("Refresh token was not received. This can happen on re-authentication if you already granted consent. To get a new one, you may need to revoke access in your Google account and reconnect the app.");
        }

        const userPreferencesRef = ref(db, `UserPreferences/${userId}/googleCalendar`);
        await set(userPreferencesRef, {
            integrated: true,
            tokens: tokens,
            writtenBy: userId, // Add the userId to the data payload for security rule validation
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
