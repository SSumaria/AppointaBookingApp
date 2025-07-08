import { google } from 'googleapis';
import { db } from './firebaseConfig';
import { ref, get, set } from 'firebase/database';
import type { Auth } from 'googleapis';

interface GoogleTokens {
    access_token: string;
    refresh_token?: string;
    scope: string;
    token_type: 'Bearer';
    expiry_date: number;
}

/**
 * Gets a user's stored Google API tokens from Firebase RTDB.
 */
async function getUserTokens(userId: string): Promise<GoogleTokens | null> {
    const tokensRef = ref(db, `UserPreferences/${userId}/googleCalendar/tokens`);
    const snapshot = await get(tokensRef);
    if (snapshot.exists()) {
        return snapshot.val() as GoogleTokens;
    }
    return null;
}

/**
 * Creates and returns an authenticated OAuth2 client for a given user.
 * It fetches the user's tokens from the database, sets them on the client,
 * and handles token refreshing if necessary.
 */
export async function getAuthenticatedClient(userId: string): Promise<Auth.OAuth2Client | null> {
    const tokens = await getUserTokens(userId);
    if (!tokens) {
        console.log(`No Google tokens found for user ${userId}. Cannot create authenticated client.`);
        return null;
    }

    const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );
    client.setCredentials(tokens);

    // Check if the access token is expired or close to expiring.
    if (tokens.expiry_date < Date.now() + 60000) { // 60-second buffer
        console.log(`Access token for user ${userId} is expired or nearing expiration. Refreshing...`);
        try {
            const { credentials } = await client.refreshAccessToken();
            const newTokens = { ...tokens, ...credentials };
            
            const tokensRef = ref(db, `UserPreferences/${userId}/googleCalendar/tokens`);
            await set(tokensRef, newTokens);

            client.setCredentials(newTokens);
            console.log(`Access token for user ${userId} refreshed and saved successfully.`);
        } catch (error) {
            console.error(`Failed to refresh access token for user ${userId}. They may need to re-authenticate.`, error);
            // Optionally, clear the invalid tokens from the DB here
            return null;
        }
    }

    return client;
}
