
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseConfig';
import { ref, get, update } from 'firebase/database';
import { getAuthenticatedClient } from '@/lib/googleCalendar';
import { google } from 'googleapis';

interface Booking {
    id: string;
    AppointmentID: string;
    ClientID: string;
    ServiceProcedure: string;
    AppointmentDate: string; // yyyy-MM-dd
    AppointmentStartTime: string; // HH:mm
    AppointmentEndTime: string; // HH:mm
    BookedByUserID: string;
    googleEventId?: string;
    _ClientNameSnapshot?: string;
    _ClientEmailSnapshot?: string;
}

interface Client {
    ClientName: string;
    ClientEmail?: string;
}

export async function POST(request: Request) {
    console.log("\n--- [GCAL SYNC START] ---");
    const { action, bookingId, userId, timeZone } = await request.json();
    console.log(`[GCAL SYNC] Received request: action=${action}, bookingId=${bookingId}, userId=${userId}, timeZone=${timeZone}`);

    if (!action || !bookingId || !userId) {
        return NextResponse.json({ success: false, message: 'Missing required parameters: action, bookingId, or userId' }, { status: 400 });
    }

    try {
        const bookingRefPath = `Appointments/${userId}/${bookingId}`;
        const bookingRef = ref(db, bookingRefPath);
        const bookingSnapshot = await get(bookingRef);

        if (!bookingSnapshot.exists()) {
            console.error(`[GCAL SYNC] Booking not found at path: ${bookingRefPath}`);
            return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 });
        }
        
        const bookingData = { id: bookingSnapshot.key, ...bookingSnapshot.val() } as Booking;
        console.log("[GCAL SYNC] Fetched booking data:", JSON.stringify(bookingData, null, 2));
        
        if (bookingData.BookedByUserID !== userId) {
            console.error(`[GCAL SYNC] Unauthorized access attempt. User ${userId} tried to access booking owned by ${bookingData.BookedByUserID}.`);
            return NextResponse.json({ success: false, message: 'Unauthorized access to booking' }, { status: 403 });
        }
        
        const calendarClient = await getAuthenticatedClient(userId);

        if (!calendarClient) {
            console.log(`[GCAL SYNC] User ${userId} has no valid Google Calendar integration. Skipping sync for booking ${bookingId}.`);
            return NextResponse.json({ success: true, message: 'Google Calendar not connected. Sync skipped.' });
        }
        
        console.log("[GCAL SYNC] Successfully obtained authenticated Google Calendar client.");

        // --- Start of Robust Client Data Retrieval ---
        let clientName = bookingData._ClientNameSnapshot;
        let clientEmail = bookingData._ClientEmailSnapshot;

        if (!clientName || !clientEmail) {
            console.log(`[GCAL SYNC] Snapshot data incomplete for booking ${bookingId}. Fetching client details for ClientID: ${bookingData.ClientID}`);
            const clientRef = ref(db, `Clients/${userId}/${bookingData.ClientID}`);
            const clientSnapshot = await get(clientRef);
            if (clientSnapshot.exists()) {
                const clientData = clientSnapshot.val() as Client;
                clientName = clientData.ClientName;
                clientEmail = clientData.ClientEmail;
                console.log(`[GCAL SYNC] Fallback successful. Found client: ${clientName} (${clientEmail})`);
            } else {
                console.warn(`[GCAL SYNC] Could not find client details in fallback for ClientID: ${bookingData.ClientID}`);
            }
        } else {
            console.log(`[GCAL SYNC] Using snapshot data for client: ${clientName} (${clientEmail})`);
        }
        // --- End of Robust Client Data Retrieval ---

        const eventTimeZone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!timeZone) {
            console.warn(`[GCAL SYNC] Timezone not provided by client. Falling back to server timezone: ${eventTimeZone}`);
        }
        
        const event = {
            summary: `Appointment: ${bookingData.ServiceProcedure}`,
            description: `Client: ${clientName || 'N/A'}\nService: ${bookingData.ServiceProcedure}`,
            start: {
                dateTime: `${bookingData.AppointmentDate}T${bookingData.AppointmentStartTime}:00`,
                timeZone: eventTimeZone,
            },
            end: {
                dateTime: `${bookingData.AppointmentDate}T${bookingData.AppointmentEndTime}:00`,
                timeZone: eventTimeZone,
            },
            attendees: clientEmail ? [{ email: clientEmail }] : [],
            reminders: {
                useDefault: true,
            },
        };
        
        console.log("[GCAL SYNC] Constructed event object for Google Calendar:", JSON.stringify(event, null, 2));

        const calendar = google.calendar({ version: 'v3', auth: calendarClient });
        
        // This object includes the user ID to authorize the write operation in Firebase Rules.
        const serverUpdatePayload = (googleEventId: string | null) => ({
            googleEventId: googleEventId,
            _serverUpdatedBy: userId 
        });

        switch (action) {
            case 'create': {
                console.log("[GCAL SYNC] Action: create. Inserting event...");
                const createdEvent = await calendar.events.insert({
                    calendarId: 'primary',
                    requestBody: event,
                });
                const eventId = createdEvent.data.id;
                if (eventId) {
                    await update(bookingRef, serverUpdatePayload(eventId));
                    console.log(`[GCAL SYNC] SUCCESS: Created Google Calendar event ${eventId} for booking ${bookingId}`);
                }
                return NextResponse.json({ success: true, eventId: eventId });
            }

            case 'update': {
                if (!bookingData.googleEventId) {
                    console.warn(`[GCAL SYNC] No googleEventId for booking ${bookingId}. Cannot update. Attempting to create instead.`);
                     const createdEvent = await calendar.events.insert({
                        calendarId: 'primary',
                        requestBody: event,
                    });
                    const eventId = createdEvent.data.id;
                    if (eventId) {
                        await update(bookingRef, serverUpdatePayload(eventId));
                         console.log(`[GCAL SYNC] SUCCESS: Created Google Calendar event ${eventId} for updated booking ${bookingId}`);
                    }
                    return NextResponse.json({ success: true, eventId: eventId });
                }
                console.log(`[GCAL SYNC] Action: update. Updating event ${bookingData.googleEventId}...`);
                const updatedEvent = await calendar.events.update({
                    calendarId: 'primary',
                    eventId: bookingData.googleEventId,
                    requestBody: event,
                });
                console.log(`[GCAL SYNC] SUCCESS: Updated Google Calendar event ${updatedEvent.data.id} for booking ${bookingId}`);
                return NextResponse.json({ success: true, eventId: updatedEvent.data.id });
            }

            case 'delete': {
                if (!bookingData.googleEventId) {
                    console.log(`[GCAL SYNC] Action: delete. No googleEventId for booking ${bookingId}. Nothing to do.`);
                    return NextResponse.json({ success: true, message: 'No Google Event to delete.' });
                }
                try {
                    console.log(`[GCAL SYNC] Action: delete. Deleting event ${bookingData.googleEventId}...`);
                    await calendar.events.delete({
                        calendarId: 'primary',
                        eventId: bookingData.googleEventId,
                    });
                    await update(bookingRef, serverUpdatePayload(null));
                    console.log(`[GCAL SYNC] SUCCESS: Deleted Google Calendar event ${bookingData.googleEventId} for booking ${bookingId}`);
                } catch (deleteError: any) {
                    // If the event is already deleted on Google's side, it will throw an error (404 or 410).
                    // We can safely ignore this and proceed with cleaning up our DB.
                    if (deleteError.code === 404 || deleteError.code === 410) {
                        console.log(`[GCAL SYNC] Event ${bookingData.googleEventId} not found on Google Calendar. It was likely already deleted. Cleaning up local record.`);
                        await update(bookingRef, serverUpdatePayload(null));
                    } else {
                        throw deleteError; // Re-throw other errors
                    }
                }
                return NextResponse.json({ success: true });
            }

            default:
                console.error(`[GCAL SYNC] Invalid action: ${action}`);
                return NextResponse.json({ success: false, message: `Invalid action: ${action}` }, { status: 400 });
        }

    } catch (error: any) {
        console.error('[GCAL SYNC] FATAL ERROR:', error.response?.data || error.message);
        return NextResponse.json({ success: false, message: 'Calendar sync failed.', error: error.message }, { status: 500 });
    }
}
