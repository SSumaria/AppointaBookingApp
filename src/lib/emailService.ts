

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

const createStyledEmailHtml = (title: string, content: string): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; margin: 0; padding: 0; background-color: #f2f4f6; }
        .container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background-color: #3B82F6; color: #ffffff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 24px; color: #333333; line-height: 1.6; }
        .content h2 { color: #3B82F6; font-size: 20px; }
        .content ul { list-style: none; padding: 0; }
        .content li { background-color: #f8f9fa; margin-bottom: 8px; padding: 12px; border-left: 4px solid #3B82F6; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #777777; }
        .footer img { height: 32px; width: auto; margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <div style="padding: 20px;">
        <div class="container">
          <div class="header"><h1>${title}</h1></div>
          <div class="content">${content}</div>
          <div class="footer">
            <img src="https://firebasestorage.googleapis.com/v0/b/appointa-409a6.appspot.com/o/appointa_logo3.png?alt=media&token=3813a35b-d784-4861-953b-28063a1e4b33" alt="Appointa Logo">
            <p>&copy; ${new Date().getFullYear()} Appointa. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
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
        const content = `
            <p>Hi ${clientName},</p>
            <p>This is a confirmation for the following appointment:</p>
            <ul>
                <li><strong>Service:</strong> ${service}</li>
                <li><strong>Date:</strong> ${appointmentDate}</li>
                <li><strong>Time:</strong> ${appointmentTime}</li>
            </ul>
            <p>We look forward to seeing you!</p>
        `;
        const html = createStyledEmailHtml("Appointment Confirmed", content);
        // Send to both provider and client
        await sendEmail({ to: providerEmail, toName: "Service Provider", subject, html });
        await sendEmail({ to: clientEmail, toName: clientName, subject, html });
    },

    sendCancellationNotice: async ({ providerEmail, clientName, clientEmail, appointmentDate, appointmentTime, service }: BookingEmailParams) => {
        const subject = `Appointment Canceled: ${service} on ${appointmentDate}`;
        const content = `
             <p>Hi ${clientName},</p>
            <p>This is a notification that the following appointment has been canceled:</p>
            <ul>
                <li><strong>Service:</strong> ${service}</li>
                <li><strong>Date:</strong> ${appointmentDate}</li>
                <li><strong>Time:</strong> ${appointmentTime}</li>
            </ul>
        `;
        const html = createStyledEmailHtml("Appointment Canceled", content);

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
        const content = `
            <p>Hi ${clientName},</p>
            <p>This is a notification that your appointment has been updated.</p>
            <h2>Previous Details:</h2>
            <ul>
                <li><strong>Service:</strong> ${oldDetails.service}</li>
                <li><strong>Date:</strong> ${oldDetails.date}</li>
                <li><strong>Time:</strong> ${oldDetails.time}</li>
            </ul>
            <h2>New Details:</h2>
            <ul>
                <li><strong>Service:</strong> ${newDetails.service}</li>
                <li><strong>Date:</strong> ${newDetails.date}</li>
                <li><strong>Time:</strong> ${newDetails.time}</li>
            </ul>
        `;
        const html = createStyledEmailHtml("Appointment Updated", content);
        
        await sendEmail({ to: providerEmail, toName: "Service Provider", subject, html });
        await sendEmail({ to: clientEmail, toName: clientName, subject, html });
    },

    sendReminder: async ({ providerEmail, clientName, clientEmail, appointmentDate, appointmentTime, service }: BookingEmailParams) => {
        const subject = `Reminder: Your appointment for ${service} is tomorrow!`;
        const content = `
            <p>Hi ${clientName},</p>
            <p>This is a friendly reminder for your upcoming appointment:</p>
            <ul>
                <li><strong>Service:</strong> ${service}</li>
                <li><strong>Date:</strong> ${appointmentDate}</li>
                <li><strong>Time:</strong> ${appointmentTime}</li>
            </ul>
            <p>We look forward to seeing you!</p>
        `;
        const html = createStyledEmailHtml("Appointment Reminder", content);
        await sendEmail({ to: providerEmail, toName: "Service Provider", subject, html });
        await sendEmail({ to: clientEmail, toName: clientName, subject, html });
    },
};
