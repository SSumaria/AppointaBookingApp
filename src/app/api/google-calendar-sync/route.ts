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

export async function POST(request: Request) {
    const { action, bookingId, userId } = await request.json();

    if (!action || !bookingId || !userId) {
        return NextResponse.json({ success: false, message: 'Missing required parameters: action, bookingId, or userId' }, { status: 400 });
    }

    try {
        const bookingRefPath = `Appointments/${userId}/${bookingId}`;
        const bookingRef = ref(db, bookingRefPath);
        const bookingSnapshot = await get(bookingRef);

        if (!bookingSnapshot.exists()) {
            return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 });
        }
        
        const bookingData = { id: bookingSnapshot.key, ...bookingSnapshot.val() } as Booking;
        
        if (bookingData.BookedByUserID !== userId) {
            return NextResponse.json({ success: false, message: 'Unauthorized access to booking' }, { status: 403 });
        }
        
        const calendarClient = await getAuthenticatedClient(userId);

        if (!calendarClient) {
            console.log(`User ${userId} has no valid Google Calendar integration. Skipping sync for booking ${bookingId}.`);
            // This is not an error, just a state. We return success=true to not show an error to the user.
            return NextResponse.json({ success: true, message: 'Google Calendar not connected. Sync skipped.' });
        }

        const calendar = google.calendar({ version: 'v3', auth: calendarClient });
        const serverTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const event = {
            summary: `Appointment: ${bookingData.ServiceProcedure}`,
            description: `Client: ${bookingData._ClientNameSnapshot || 'N/A'}\nService: ${bookingData.ServiceProcedure}`,
            start: {
                dateTime: `${bookingData.AppointmentDate}T${bookingData.AppointmentStartTime}:00`,
                timeZone: serverTimeZone,
            },
            end: {
                dateTime: `${bookingData.AppointmentDate}T${bookingData.AppointmentEndTime}:00`,
                timeZone: serverTimeZone,
            },
            attendees: bookingData._ClientEmailSnapshot ? [{ email: bookingData._ClientEmailSnapshot }] : [],
            reminders: {
                useDefault: true,
            },
        };

        switch (action) {
            case 'create': {
                const createdEvent = await calendar.events.insert({
                    calendarId: 'primary',
                    requestBody: event,
                });
                const eventId = createdEvent.data.id;
                if (eventId) {
                    await update(bookingRef, { googleEventId: eventId });
                    console.log(`Created Google Calendar event ${eventId} for booking ${bookingId}`);
                }
                return NextResponse.json({ success: true, eventId: eventId });
            }

            case 'update': {
                if (!bookingData.googleEventId) {
                    console.log(`No googleEventId for booking ${bookingId}. Cannot update. Attempting to create instead.`);
                     const createdEvent = await calendar.events.insert({
                        calendarId: 'primary',
                        requestBody: event,
                    });
                    const eventId = createdEvent.data.id;
                    if (eventId) {
                        await update(bookingRef, { googleEventId: eventId });
                         console.log(`Created Google Calendar event ${eventId} for updated booking ${bookingId}`);
                    }
                    return NextResponse.json({ success: true, eventId: eventId });
                }
                const updatedEvent = await calendar.events.update({
                    calendarId: 'primary',
                    eventId: bookingData.googleEventId,
                    requestBody: event,
                });
                console.log(`Updated Google Calendar event ${updatedEvent.data.id} for booking ${bookingId}`);
                return NextResponse.json({ success: true, eventId: updatedEvent.data.id });
            }

            case 'delete': {
                if (!bookingData.googleEventId) {
                    console.log(`No googleEventId for booking ${bookingId}. Cannot delete.`);
                    return NextResponse.json({ success: true, message: 'No Google Event to delete.' });
                }
                try {
                    await calendar.events.delete({
                        calendarId: 'primary',
                        eventId: bookingData.googleEventId,
                    });
                    await update(bookingRef, { googleEventId: null });
                    console.log(`Deleted Google Calendar event ${bookingData.googleEventId} for booking ${bookingId}`);
                } catch (deleteError: any) {
                    // If the event is already deleted on Google's side, it will throw an error (404 or 410).
                    // We can safely ignore this and proceed with cleaning up our DB.
                    if (deleteError.code === 404 || deleteError.code === 410) {
                        console.log(`Event ${bookingData.googleEventId} not found on Google Calendar. It was likely already deleted. Cleaning up local record.`);
                        await update(bookingRef, { googleEventId: null });
                    } else {
                        throw deleteError; // Re-throw other errors
                    }
                }
                return NextResponse.json({ success: true });
            }

            default:
                return NextResponse.json({ success: false, message: `Invalid action: ${action}` }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Google Calendar sync failed:', error.response?.data || error.message);
        return NextResponse.json({ success: false, message: 'Calendar sync failed.', error: error.message }, { status: 500 });
    }
}
