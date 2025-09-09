

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
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
          margin: 0; 
          padding: 0; 
          background-color: hsl(220, 14%, 96%); /* Light Gray Background */
        }
        .wrapper {
          padding: 20px;
        }
        .container { 
          width: 100%; 
          max-width: 600px; 
          margin: 0 auto; 
          background-color: #ffffff; 
          border: 1px solid hsl(0, 0%, 89.8%); /* Border */
          border-radius: 0.5rem; /* Match app's border radius */
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
          overflow: hidden; 
        }
        .header { 
          background-color: hsl(211, 63%, 56%); /* Calming Blue */
          color: #ffffff; 
          padding: 24px; 
          text-align: center; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 24px; 
          font-weight: 600;
        }
        .content { 
          padding: 24px; 
          color: hsl(0, 0%, 3.9%); /* Foreground */
          line-height: 1.6; 
          font-size: 16px;
        }
        .content h2 { 
          color: hsl(211, 63%, 56%); /* Calming Blue */
          font-size: 20px; 
          font-weight: 600;
        }
        .content ul { 
          list-style: none; 
          padding: 0; 
        }
        .content li { 
          background-color: hsl(220, 13%, 91%); /* Muted */
          margin-bottom: 8px; 
          padding: 12px 16px; 
          border-left: 4px solid hsl(211, 63%, 56%); /* Primary blue accent */
          border-radius: 4px; 
        }
        .content li strong {
          color: hsl(0, 0%, 9%); /* Secondary Foreground */
        }
        .footer { 
          text-align: center; 
          padding: 20px; 
          font-size: 12px; 
          color: hsl(0, 0%, 45.1%); /* Muted Foreground */
          background-color: hsl(220, 14%, 96%);
          border-top: 1px solid hsl(0, 0%, 89.8%);
        }
        .footer img { 
          height: 32px; 
          width: auto; 
          margin-bottom: 8px; 
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
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
    providerName: string;
    providerEmail: string;
    clientName: string;
    clientEmail: string;
    appointmentDate: string; // Should be pre-formatted (e.g., "PPP")
    appointmentTime: string;
    service: string;
}

interface UpdateEmailParams {
    providerName: string;
    providerEmail: string;
    clientName: string;
    clientEmail: string;
    oldDetails: { date: string, time: string, service: string };
    newDetails: { date: string, time: string, service: string };
}

export const emailService = {
    sendConfirmationNotice: async ({ providerName, providerEmail, clientName, clientEmail, appointmentDate, appointmentTime, service }: BookingEmailParams) => {
        // --- For Client ---
        const clientSubject = `Appointment Confirmed with ${providerName}`;
        const clientContent = `
            <p>Hi ${clientName},</p>
            <p>This is a confirmation for your appointment with <strong>${providerName}</strong>:</p>
            <ul>
                <li><strong>Service:</strong> ${service}</li>
                <li><strong>Date:</strong> ${appointmentDate}</li>
                <li><strong>Time:</strong> ${appointmentTime}</li>
            </ul>
            <p>We look forward to seeing you!</p>
        `;
        const clientHtml = createStyledEmailHtml("Appointment Confirmed", clientContent);
        await sendEmail({ to: clientEmail, toName: clientName, subject: clientSubject, html: clientHtml });
        
        // --- For Provider ---
        const providerSubject = `New Booking with ${clientName}`;
        const providerContent = `
            <p>Hi ${providerName},</p>
            <p>You have a new booking from <strong>${clientName}</strong>:</p>
            <ul>
                <li><strong>Service:</strong> ${service}</li>
                <li><strong>Date:</strong> ${appointmentDate}</li>
                <li><strong>Time:</strong> ${appointmentTime}</li>
            </ul>
        `;
        const providerHtml = createStyledEmailHtml("New Booking Notification", providerContent);
        await sendEmail({ to: providerEmail, toName: providerName, subject: providerSubject, html: providerHtml });
    },

    sendCancellationNotice: async ({ providerName, providerEmail, clientName, clientEmail, appointmentDate, appointmentTime, service }: BookingEmailParams) => {
        // --- For Client ---
        const clientSubject = `Appointment Canceled with ${providerName}`;
        const clientContent = `
             <p>Hi ${clientName},</p>
            <p>This is a notification that your appointment with <strong>${providerName}</strong> has been canceled:</p>
            <ul>
                <li><strong>Service:</strong> ${service}</li>
                <li><strong>Date:</strong> ${appointmentDate}</li>
                <li><strong>Time:</strong> ${appointmentTime}</li>
            </ul>
        `;
        const clientHtml = createStyledEmailHtml("Appointment Canceled", clientContent);
        await sendEmail({ to: clientEmail, toName: clientName, subject: clientSubject, html: clientHtml });

        // --- For Provider ---
        const providerSubject = `Canceled Booking with ${clientName}`;
        const providerContent = `
            <p>Hi ${providerName},</p>
            <p>Your booking with <strong>${clientName}</strong> has been canceled:</p>
             <ul>
                <li><strong>Service:</strong> ${service}</li>
                <li><strong>Date:</strong> ${appointmentDate}</li>
                <li><strong>Time:</strong> ${appointmentTime}</li>
            </ul>
        `;
        const providerHtml = createStyledEmailHtml("Booking Cancellation", providerContent);
        await sendEmail({ to: providerEmail, toName: providerName, subject: providerSubject, html: providerHtml });
    },

    sendUpdateNotice: async ({ providerName, providerEmail, clientName, clientEmail, oldDetails, newDetails }: UpdateEmailParams) => {
        // --- For Client ---
        const clientSubject = `Appointment Updated with ${providerName}`;
        const clientContent = `
            <p>Hi ${clientName},</p>
            <p>Your appointment with <strong>${providerName}</strong> has been updated.</p>
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
        const clientHtml = createStyledEmailHtml("Appointment Updated", clientContent);
        await sendEmail({ to: clientEmail, toName: clientName, subject: clientSubject, html: clientHtml });
        
        // --- For Provider ---
        const providerSubject = `Updated Booking with ${clientName}`;
        const providerContent = `
             <p>Hi ${providerName},</p>
            <p>Your appointment with <strong>${clientName}</strong> has been updated.</p>
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
        const providerHtml = createStyledEmailHtml("Booking Updated", providerContent);
        await sendEmail({ to: providerEmail, toName: providerName, subject: providerSubject, html: providerHtml });
    },
};
