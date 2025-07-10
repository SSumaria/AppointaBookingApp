
import { NextResponse, type NextRequest } from 'next/server';
import { google } from 'googleapis';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebaseConfig';

export async function GET(request: NextRequest) {
    console.log("\n--- [GOOGLE CALLBACK START] ---");
    console.log(`Callback received at: ${new Date().toISOString()}`);

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const encodedState = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    console.log(`Received query params: code=${code ? 'PRESENT' : 'MISSING'}, state=${encodedState ? 'PRESENT' : 'MISSING'}, error=${error || 'NONE'}`);
    
    let userId: string;
    let clientOriginForRedirect: string;
    let tokenExchangeRedirectUri: string;

    const buildRedirectHtml = (targetUrl: string, message: string) => `
        <!DOCTYPE html>
        <html><head><title>Redirecting...</title><script>window.location.href = "${targetUrl}";</script></head>
        <body><p>${message} If you are not redirected automatically, <a href="${targetUrl}">click here</a>.</p></body></html>`;

    // The state parameter is the single source of truth for the user ID and the original client origin.
    // If it's missing or malformed, we cannot proceed securely.
    try {
        if (!encodedState) throw new Error('State parameter is missing from callback.');
        const stateJSON = Buffer.from(encodedState, 'base64').toString('utf8');
        const state = JSON.parse(stateJSON);
        if (!state.userId) throw new Error('Invalid state: missing userId.');
        if (!state.clientOrigin) throw new Error('Invalid state: missing clientOrigin.');
        
        userId = state.userId;
        clientOriginForRedirect = state.clientOrigin;
        tokenExchangeRedirectUri = `${clientOriginForRedirect}/api/auth/google/callback`;

        console.log(`Successfully parsed state: userId=${userId}, clientOrigin=${clientOriginForRedirect}`);
    } catch (e: any) {
        console.error("FATAL: Failed to parse state parameter:", e.message);
        const htmlError = `<html><body>Authentication Error: Invalid or missing state parameter. Please try connecting again from the preferences page. This is a critical security check.</body></html>`;
        return new NextResponse(htmlError, { status: 400, headers: { 'Content-Type': 'text/html' } });
    }
    
    const finalErrorRedirectUrl = (msg: string) => `${clientOriginForRedirect}/preferences?status=error&message=${encodeURIComponent(msg)}`;

    if (error) {
        console.error(`Google OAuth Error received: ${error} - ${errorDescription || 'No description'}`);
        return new NextResponse(buildRedirectHtml(finalErrorRedirectUrl(errorDescription || error), `Redirecting with error: ${error}`), { status: 200, headers: { 'Content-Type': 'text/html' }});
    }

    if (!code) {
        const errorMessage = 'Missing authorization code from Google. Cannot complete connection.';
        console.error(errorMessage);
        return new NextResponse(buildRedirectHtml(finalErrorRedirectUrl(errorMessage), "Redirecting with error..."), { status: 200, headers: { 'Content-Type': 'text/html' }});
    }

    console.log(`Using Redirect URI for token exchange: ${tokenExchangeRedirectUri}`);
    
    const oAuth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      tokenExchangeRedirectUri
    );

    let tokens;
    try {
        console.log("Attempting to exchange authorization code for tokens with Google...");
        const response = await oAuth2Client.getToken(code);
        tokens = response.tokens;
        console.log("Successfully exchanged code for tokens. Refresh token was " + (tokens.refresh_token ? "received." : "NOT received."));
    } catch (err: any) {
        console.error('FATAL: Error during token exchange with Google:', err.response?.data || err.message);
        let errorMessage = `Token exchange failed: ${err.response?.data?.error_description || err.message}`;
        if (err.response?.data?.error === 'redirect_uri_mismatch') {
            errorMessage += ` The URI sent was '${tokenExchangeRedirectUri}'. Please ensure this EXACT URI is listed in your Google Cloud Console "Authorized redirect URIs".`;
        }
        return new NextResponse(buildRedirectHtml(finalErrorRedirectUrl(errorMessage), "Redirecting with error..."), { status: 200, headers: { 'Content-Type': 'text/html' } });
    }

    try {
        const userPreferencesRef = ref(db, `UserPreferences/${userId}/googleCalendar`);
        const payload = {
            integrated: true,
            tokens: tokens,
            writtenBy: userId,
        };

        console.log(`Attempting to write to database for user ${userId}. Path: ${userPreferencesRef.toString()}`);
        console.log("Payload to be written:", JSON.stringify(payload, (key, value) => (key === 'access_token' || key === 'refresh_token') && value ? 'HIDDEN' : value, 2));

        await set(userPreferencesRef, payload);

        console.log(`Successfully stored Google Calendar tokens for user ${userId}`);
        console.log("--- [GOOGLE CALLBACK SUCCESS] ---");

        const finalSuccessRedirectUrl = `${clientOriginForRedirect}/preferences?status=success`;
        return new NextResponse(buildRedirectHtml(finalSuccessRedirectUrl, "Connection successful! Redirecting..."), { status: 200, headers: { 'Content-Type': 'text/html' } });

    } catch (dbError: any) {
        console.error('FATAL: Error saving tokens to Firebase Realtime Database:', dbError.message);
        const errorMessage = `Saving to database failed: ${dbError.message}. Check your database rules. The error you are seeing on the page is likely this one.`;
        return new NextResponse(buildRedirectHtml(finalErrorRedirectUrl(errorMessage), "Redirecting with error..."), { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
}

    