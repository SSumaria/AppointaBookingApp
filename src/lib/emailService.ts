
// A mock email service for demonstration purposes.
// In a real application, you would replace this with a real email provider like SendGrid, Mailgun, etc.
// This service is now called exclusively from the /api/send-email route.

interface EmailParams {
    to: string;
    subject: string;
    html: string;
}

const sendEmail = async (params: EmailParams) => {
    console.log("--- SIMULATING EMAIL SEND ---");
    console.log(`To: ${params.to}`);
    console.log(`Subject: ${params.subject}`);
    console.log("Body (HTML):");
    console.log(params.html);
    console.log("-----------------------------");
    // In a real implementation, this would involve an API call to your email provider.
    // e.g., await resend.emails.send({ ... });
    return Promise.resolve();
};

interface BookingEmailParams {
    providerEmail: string;
    clientName: string;
    clientEmail: string;
    appointmentDate: string; // Should be pre-formatted (e.g., "PPP")
    appointmentTime: string;
    service: string;
}

export const emailService = {
    sendConfirmationNotice: async ({ providerEmail, clientName, clientEmail, appointmentDate, appointmentTime, service }: BookingEmailParams) => {
        const subject = `Appointment Confirmed: ${service} on ${appointmentDate}`;
        const html = `
            <h1>Appointment Confirmed</h1>
            <p>This is a confirmation for the following appointment:</p>
            <ul>
                <li><strong>Client:</strong> ${clientName}</li>
                <li><strong>Service:</strong> ${service}</li>
                <li><strong>Date:</strong> ${appointmentDate}</li>
                <li><strong>Time:</strong> ${appointmentTime}</li>
            </ul>
        `;
        // Send to both provider and client
        await sendEmail({ to: providerEmail, subject, html });
        await sendEmail({ to: clientEmail, subject, html });
    },

    sendCancellationNotice: async ({ providerEmail, clientName, clientEmail, appointmentDate, appointmentTime, service }: BookingEmailParams) => {
        const subject = `Appointment Canceled: ${service} on ${appointmentDate}`;
        const html = `
            <h1>Appointment Canceled</h1>
            <p>This is a notification that the following appointment has been canceled:</p>
            <ul>
                <li><strong>Client:</strong> ${clientName}</li>
                <li><strong>Service:</strong> ${service}</li>
                <li><strong>Date:</strong> ${appointmentDate}</li>
                <li><strong>Time:</strong> ${appointmentTime}</li>
            </ul>
        `;

        // Send to both provider and client
        await sendEmail({ to: providerEmail, subject, html });
        await sendEmail({ to: clientEmail, subject, html });
    },

    sendUpdateNotice: async ({ providerEmail, clientName, clientEmail, oldDetails, newDetails }: {
        providerEmail: string;
        clientName: string;
        clientEmail: string;
        oldDetails: { date: string, time: string, service: string };
        newDetails: { date:string, time: string, service: string };
    }) => {
        const subject = `Appointment Updated: ${newDetails.service} on ${newDetails.date}`;
        const html = `
            <h1>Appointment Updated</h1>
            <p>This is a notification that an appointment for <strong>${clientName}</strong> has been updated.</p>
            <h3>Previous Details:</h3>
            <ul>
                <li><strong>Service:</strong> ${oldDetails.service}</li>
                <li><strong>Date:</strong> ${oldDetails.date}</li>
                <li><strong>Time:</strong> ${oldDetails.time}</li>
            </ul>
            <h3>New Details:</h3>
            <ul>
                <li><strong>Service:</strong> ${newDetails.service}</li>
                <li><strong>Date:</strong> ${newDetails.date}</li>
                <li><strong>Time:</strong> ${newDetails.time}</li>
            </ul>
        `;
        
        await sendEmail({ to: providerEmail, subject, html });
        await sendEmail({ to: clientEmail, subject, html });
    },

    sendReminder: async ({ providerEmail, clientName, clientEmail, appointmentDate, appointmentTime, service }: BookingEmailParams) => {
        const subject = `Reminder: Your appointment for ${service} is tomorrow!`;
        const html = `
            <h1>Appointment Reminder</h1>
            <p>This is a reminder for your upcoming appointment:</p>
            <ul>
                <li><strong>Client:</strong> ${clientName}</li>
                <li><strong>Service:</strong> ${service}</li>
                <li><strong>Date:</strong> ${appointmentDate}</li>
                <li><strong>Time:</strong> ${appointmentTime}</li>
            </ul>
            <p>We look forward to seeing you!</p>
        `;

        await sendEmail({ to: providerEmail, subject, html });
        await sendEmail({ to: clientEmail, subject, html });
    },
};
