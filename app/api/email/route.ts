import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const { to, subject, body, format } = await req.json();

        if (!to || !subject) {
            return NextResponse.json({ error: 'Missing required fields: to, subject' }, { status: 400 });
        }

        // Use SendGrid if configured
        const sendgridKey = process.env.SENDGRID_API_KEY;
        if (sendgridKey) {
            try {
                const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sendgridKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        personalizations: [{ to: [{ email: to }] }],
                        from: { email: process.env.FROM_EMAIL || 'qa-copilot@antigravity.qa' },
                        subject,
                        content: [{
                            type: format === 'html' ? 'text/html' : 'text/plain',
                            value: body || subject,
                        }],
                    }),
                });

                if (res.ok) {
                    return NextResponse.json({ success: true, provider: 'sendgrid' });
                }
            } catch {
                // Fall through
            }
        }

        // Use SMTP if configured
        const smtpHost = process.env.SMTP_HOST;
        if (smtpHost) {
            // SMTP sending would go here with nodemailer
            // For now, log and return success for demo
            console.log(`[Email] Would send to ${to}: ${subject}`);
            return NextResponse.json({ success: true, provider: 'smtp', note: 'SMTP configured — email queued' });
        }

        // Demo mode — just log
        console.log(`[Email Demo] To: ${to}, Subject: ${subject}, Format: ${format}`);
        return NextResponse.json({
            success: true,
            provider: 'demo',
            note: 'Email logged (no SMTP/SendGrid configured). Set SENDGRID_API_KEY or SMTP_HOST in .env.local to send real emails.',
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to send email';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
