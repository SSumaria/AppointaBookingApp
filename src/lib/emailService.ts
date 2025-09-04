
// This service integrates with the Aha Send API to send transactional emails.
// It is called exclusively from the /api/send-email route.

interface EmailParams {
    to: string;
    toName: string;
    subject: string;
    html: string;
}

const sendEmail = async (params: EmailParams) => {
    const accountId = process.env.AHASEND_ACCOUNT_ID;
    const apiKey = process.env.AHASEND_API_KEY;
    const fromEmail = process.env.AHASEND_FROM_EMAIL;
    const fromName = process.env.AHASEND_FROM_NAME;

    if (!accountId || !apiKey || !fromEmail || !fromName) {
        console.error("Aha Send environment variables are not set. Cannot send email.");
        // Silently fail in production to avoid breaking user-facing flows.
        // In a real-world scenario, you might have more robust error reporting.
        return;
    }

    const url = `https://api.ahasend.com/v2/accounts/${accountId}/messages`;
    
    const body = {
        from: {
            email: fromEmail,
            name: fromName,
        },
        recipients: [{
            email: params.to,
            name: params.toName,
        }],
        subject: params.subject,
        html_content: params.html,
        text_content: params.html.replace(/<[^>]*>?/gm, ''), // Basic conversion from HTML to text
        sandbox: true,
        sandbox_result: 'deliver'
    };

    const options = {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    };

    try {
        console.log(`--- Sending email via Aha Send to: ${params.to} ---`);
        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            console.error("Aha Send API Error:", data);
            throw new Error(`Aha Send API responded with status ${response.status}`);
        }
        
        console.log("--- Successfully sent email via Aha Send. Response:", data);
    } catch (error) {
        console.error("Error sending email with Aha Send:", error);
    }
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
        await sendEmail({ to: providerEmail, toName: "Service Provider", subject, html });
        await sendEmail({ to: clientEmail, toName: clientName, subject, html });
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
        await sendEmail({ to: providerEmail, toName: "Service Provider", subject, html });
        await sendEmail({ to: clientEmail, toName: clientName, subject, html });
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
        
        await sendEmail({ to: providerEmail, toName: "Service Provider", subject, html });
        await sendEmail({ to: clientEmail, toName: clientName, subject, html });
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

        await sendEmail({ to: providerEmail, toName: "Service Provider", subject, html });
        await sendEmail({ to: clientEmail, toName: clientName, subject, html });
    },
};
