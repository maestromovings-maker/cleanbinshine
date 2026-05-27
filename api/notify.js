const { Resend } = require('resend');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const {
    name, phone, email, address,
    plan, frequency, preferred_date, notes
  } = req.body;

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'cleanbinshine@gmail.com',
      subject: `🗑️ New Booking — ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d2248;color:#f5f0e8;padding:32px;border-radius:12px;">
          <h2 style="color:#e8a81e;letter-spacing:3px;margin-bottom:4px;">CLEAN BIN SHINE</h2>
          <p style="color:#8fa0b8;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-top:0">New Booking Request</p>
          <table style="width:100%;border-collapse:collapse;margin-top:24px;">
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8fa0b8;font-size:12px;text-transform:uppercase;width:35%">Name</td><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:bold">${name}</td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8fa0b8;font-size:12px;text-transform:uppercase">Phone</td><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08)"><a href="tel:${phone}" style="color:#e8a81e">${phone}</a></td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8fa0b8;font-size:12px;text-transform:uppercase">Email</td><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08)"><a href="mailto:${email}" style="color:#e8a81e">${email}</a></td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8fa0b8;font-size:12px;text-transform:uppercase">Address</td><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08)">${address}</td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8fa0b8;font-size:12px;text-transform:uppercase">Plan</td><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#e8a81e;font-weight:bold">${plan}</td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8fa0b8;font-size:12px;text-transform:uppercase">Frequency</td><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08)">${frequency || 'One-time'}</td></tr>
            <tr><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8fa0b8;font-size:12px;text-transform:uppercase">Date</td><td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.08)">${preferred_date || 'Flexible'}</td></tr>
            <tr><td style="padding:12px 0;color:#8fa0b8;font-size:12px;text-transform:uppercase">Notes</td><td style="padding:12px 0">${notes || '—'}</td></tr>
          </table>
          <div style="margin-top:32px;background:rgba(232,168,30,0.1);border:1px solid rgba(232,168,30,0.3);border-radius:8px;padding:16px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#8fa0b8">Reply or call the customer directly to confirm.</p>
          </div>
          <p style="margin-top:24px;font-size:11px;color:#8fa0b8;text-align:center;">Clean Bin Shine · Fort Worth / Dallas, TX · (682) 222-6518</p>
        </div>
      `
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Resend error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
};
