const fs = require('fs');
const path = require('path');

const useResend = Boolean(process.env.RESEND_API_KEY);
const DEV_EMAIL_DIR = path.join(__dirname, '..', 'dev-emails');

async function sendEmail({ to, subject, text }) {
  if (useResend) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to,
        subject,
        text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Falha ao enviar email via Resend (${response.status}): ${body}`);
    }
    return;
  }

  fs.mkdirSync(DEV_EMAIL_DIR, { recursive: true });
  const fileName = `${Date.now()}-${to.replace(/[^a-z0-9]/gi, '_')}.txt`;
  const filePath = path.join(DEV_EMAIL_DIR, fileName);
  fs.writeFileSync(filePath, `Para: ${to}\nAssunto: ${subject}\n\n${text}\n`);
  console.log(`[email:dev] RESEND_API_KEY ausente — email salvo em ${filePath}`);
}

module.exports = { sendEmail, useResend, DEV_EMAIL_DIR };
