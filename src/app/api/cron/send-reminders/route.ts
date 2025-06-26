
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    console.log("--- CRON JOB DEACTIVATED ---");
    const message = "The cron job for sending reminders has been deactivated due to security constraints. It requires database rules that are too permissive. A future version may use a secure server-side implementation (e.g., Firebase Admin SDK in a Cloud Function) to re-enable this feature.";
    console.warn(message);
    return NextResponse.json({
        success: false,
        message: message,
    }, { status: 501 }); // 501 Not Implemented
}
