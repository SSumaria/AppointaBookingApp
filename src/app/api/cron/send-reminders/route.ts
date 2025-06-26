
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
    const { searchParams } = new URL(request.url);
    const cronSecretFromQuery = searchParams.get('cron_secret');

    // --- Start Enhanced Debugging ---
    console.log("\n--- CRON JOB TRIGGERED: /api/cron/send-reminders ---");
    console.log(`Received 'cron_secret' from query: '${cronSecretFromQuery}'`);
    console.log(`Node Environment (process.env.NODE_ENV): '${process.env.NODE_ENV}'`);
    const cronSecretEnv = process.env.CRON_SECRET;
    console.log(`CRON_SECRET from environment: '${cronSecretEnv ? 'SET' : 'NOT SET'}'`);
    
    if (!cronSecretEnv) {
        const errorMsg = "CRITICAL ERROR: The CRON_SECRET environment variable is not set on the server. Please create a .env.local file in your project root and add CRON_SECRET=\"your_secret_value\", then restart the server.";
        console.error(errorMsg);
        return new Response(errorMsg, { status: 500 });
    }

    const isAuthorizedByHeader = authHeader === `Bearer ${cronSecretEnv}`;
    const isAuthorizedByQueryInDev = process.env.NODE_ENV === 'development' && cronSecretFromQuery === cronSecretEnv;
    const isAuthorized = isAuthorizedByHeader || isAuthorizedByQueryInDev;

    console.log("Authorization Check Details:");
    console.log(` - Is 'development' mode? ${process.env.NODE_ENV === 'development'}`);
    console.log(` - Does query secret match env secret? ${cronSecretFromQuery === cronSecretEnv}`);
    console.log(` - Authorized by Header: ${isAuthorizedByHeader}`);
    console.log(` - Authorized by Query in Dev: ${isAuthorizedByQueryInDev}`);
    console.log(`---> FINAL AUTHORIZATION STATUS: ${isAuthorized}`);
    // --- End Enhanced Debugging ---

    if (!isAuthorized) {
        return new Response('Unauthorized. Check your secret, environment variables, and how you are calling the URL.', { status: 401 });
    }

    try {
        console.log("\nCron job starting: Fetching all data...");
        const appointmentsRef = ref(db, 'Appointments');
        const clientsRef = ref(db, 'Clients');
        const usersRef = ref(db, 'Users');

        const [appointmentsSnapshot, clientsSnapshot, usersSnapshot] = await Promise.all([
            get(appointmentsRef),
            get(clientsRef),
            get(usersRef)
        ]);

        if (!appointmentsSnapshot.exists()) {
            console.log("No 'Appointments' data found in the database.");
            return NextResponse.json({ message: "No appointments found to process." });
        }
        
        const allAppointmentsByProvider = appointmentsSnapshot.val();
        const allClientsByProvider = clientsSnapshot.exists() ? clientsSnapshot.val() : {};
        const allUsers = usersSnapshot.exists() ? usersSnapshot.val() : {};
        
        const remindersToSend: Promise<void>[] = [];

        console.log("\nProcessing appointments...");

        // Loop through each provider's appointments
        for (const providerId in allAppointmentsByProvider) {
            const appointments = allAppointmentsByProvider[providerId];
            const providerEmail = allUsers[providerId]?.email;
            
            if (!providerEmail) {
                console.warn(`- Skipping provider ${providerId}: email not found in 'Users' data.`);
                continue;
            }

            console.log(`- Processing appointments for provider: ${providerId} (${providerEmail})`);
            // Loop through each appointment for the provider
            for (const appointmentId in appointments) {
                const appointment = appointments[appointmentId];
                console.log(`  - Checking appointment ${appointmentId}: Date='${appointment.AppointmentDate}', Status='${appointment.BookingStatus}'`);

                // Check if appointment is valid, booked, and scheduled for tomorrow
                if (appointment.BookingStatus === "Booked" && appointment.AppointmentDate) {
                    try {
                        const appointmentDate = parseISO(appointment.AppointmentDate);
                        if (isTomorrow(appointmentDate)) {
                            console.log(`    ✔️ Appointment ${appointmentId} IS for tomorrow.`);
                            const clientId = appointment.ClientID;
                            const clientInfo = allClientsByProvider[providerId]?.[clientId];

                            if (clientInfo && clientInfo.ClientEmail) {
                                console.log(`      ✔️ Found client ${clientId} with email ${clientInfo.ClientEmail}. Queueing reminder.`);
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
                                console.warn(`      ❌ Skipping reminder for appointment ${appointmentId}: client details or client email not found.`);
                            }
                        }
                    } catch(e) {
                        console.error(`    ❌ Error processing appointment ${appointmentId}: could not parse date '${appointment.AppointmentDate}'`);
                    }
                }
            }
        }

        if (remindersToSend.length > 0) {
            console.log(`\nSending ${remindersToSend.length} reminders...`);
            await Promise.all(remindersToSend);
            console.log("All reminders processed.");
            return NextResponse.json({ success: true, message: `Successfully processed and queued ${remindersToSend.length} reminders.` });
        } else {
            console.log("\nNo reminders to send for tomorrow.");
            return NextResponse.json({ success: true, message: "No reminders to send for tomorrow." });
        }

    } catch (error: any) {
        console.error("\nCron job failed with an exception:", error);
        return NextResponse.json({ success: false, message: `An error occurred: ${error.message}` }, { status: 500 });
    }
}
