
import { NextResponse } from 'next/server';
import { emailService } from '@/lib/emailService';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action, ...params } = body;

        console.log(`--- [EMAIL API] Received request for action: ${action} ---`);

        switch (action) {
            case 'sendConfirmation':
                await emailService.sendConfirmationNotice(params);
                break;
            case 'sendCancellation':
                await emailService.sendCancellationNotice(params);
                break;
            case 'sendUpdate':
                await emailService.sendUpdateNotice(params);
                break;
            default:
                console.warn(`--- [EMAIL API] Unknown action: ${action} ---`);
                return NextResponse.json({ success: false, message: 'Unknown action' }, { status: 400 });
        }

        console.log(`--- [EMAIL API] Successfully processed action: ${action} ---`);
        return NextResponse.json({ success: true, message: `Email simulation for '${action}' processed.` });

    } catch (error: any) {
        console.error('--- [EMAIL API] Error processing email request:', error);
        return NextResponse.json({ success: false, message: 'Failed to process email request.', error: error.message }, { status: 500 });
    }
}
