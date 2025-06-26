import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseConfig';
import { ref, get } from 'firebase/database';
import { isTomorrow, parseISO, format } from 'date-fns';
import { emailService } from '@/lib/emailService';

// This is a simplified Client and User structure for this cron job.
interface Client {
    ClientName: string;
    ClientEmail: string;
}
interface User {
    email: string;
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        console.log("Cron job starting: Fetching all data...");
        const appointmentsRef = ref(db, 'Appointments');
        const clientsRef = ref(db, 'Clients');
        const usersRef = ref(db, 'Users');

        const [appointmentsSnapshot, clientsSnapshot, usersSnapshot] = await Promise.all([
            get(appointmentsRef),
            get(clientsRef),
            get(usersRef)
        ]);

        if (!appointmentsSnapshot.exists()) {
            return NextResponse.json({ message: "No appointments found to process." });
        }
        
        const allAppointmentsByProvider = appointmentsSnapshot.val();
        const allClientsByProvider = clientsSnapshot.exists() ? clientsSnapshot.val() : {};
        const allUsers = usersSnapshot.exists() ? usersSnapshot.val() : {};
        
        const remindersToSend: Promise<void>[] = [];

        console.log("Processing appointments...");

        // Loop through each provider's appointments
        for (const providerId in allAppointmentsByProvider) {
            const appointments = allAppointmentsByProvider[providerId];
            const providerEmail = allUsers[providerId]?.email;
            
            if (!providerEmail) {
                console.warn(`Skipping provider ${providerId}: email not found.`);
                continue;
            }

            // Loop through each appointment for the provider
            for (const appointmentId in appointments) {
                const appointment = appointments[appointmentId];

                // Check if appointment is valid, booked, and scheduled for tomorrow
                if (appointment.BookingStatus === "Booked" && appointment.AppointmentDate) {
                    try {
                        const appointmentDate = parseISO(appointment.AppointmentDate);
                        if (isTomorrow(appointmentDate)) {
                            const clientId = appointment.ClientID;
                            const clientInfo = allClientsByProvider[providerId]?.[clientId];

                            if (clientInfo && clientInfo.ClientEmail) {
                                 remindersToSend.push(
                                    emailService.sendReminder({
                                        providerEmail,
                                        clientName: clientInfo.ClientName,
                                        clientEmail: clientInfo.ClientEmail,
                                        appointmentDate: format(appointmentDate, "PPP"),
                                        appointmentTime: `${appointment.AppointmentStartTime} - ${appointment.AppointmentEndTime}`,
                                        service: appointment.ServiceProcedure,
                                    })
                                );
                            } else {
                                console.warn(`Skipping reminder for appointment ${appointmentId}: client or client email not found.`);
                            }
                        }
                    } catch(e) {
                        console.error(`Skipping reminder for appointment ${appointmentId}: could not parse date '${appointment.AppointmentDate}'`);
                    }
                }
            }
        }

        if (remindersToSend.length > 0) {
            console.log(`Sending ${remindersToSend.length} reminders...`);
            await Promise.all(remindersToSend);
            return NextResponse.json({ success: true, message: `Successfully processed ${remindersToSend.length} reminders.` });
        } else {
            return NextResponse.json({ success: true, message: "No reminders to send for tomorrow." });
        }

    } catch (error: any) {
        console.error("Cron job failed:", error);
        return NextResponse.json({ success: false, message: `An error occurred: ${error.message}` }, { status: 500 });
    }
}
