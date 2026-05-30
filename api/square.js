const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_BASE = 'https://connect.squareup.com/v2';

const LOCATION_ID = 'L9BE03X4E9DWB';
const SERVICE_VARIATION_ID = 'XOSNWWNRZXDI46N6YVPSKIMD';
const SERVICE_VARIATION_VERSION = 1780013873200;
const TEAM_MEMBER_ID = 'TMdp7ZBmdSzVu5XF';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, email, address, plan, preferred_date, notes } = req.body;

  const headers = {
    'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Square-Version': '2024-01-17'
  };

  try {
    // ── Create customer ──
    const nameParts = (name || '').trim().split(' ');
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('1') ? '+' + cleanPhone : '+1' + cleanPhone;

    const customerRes = await fetch(`${SQUARE_BASE}/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        idempotency_key: `cbs-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
        given_name: nameParts[0] || '',
        family_name: nameParts.slice(1).join(' ') || '',
        email_address: email,
        phone_number: formattedPhone,
        note: `Plan: ${plan} | Source: cleanbinshine.com`,
        address: { address_line_1: address }
      })
    });
    const customerData = await customerRes.json();
    const customerId = customerData.customer?.id;
    console.log('Customer created:', customerId);

    // ── Create appointment ──
    let startAt;
    if (preferred_date && preferred_date !== 'Flexible') {
      startAt = new Date(preferred_date + 'T09:00:00').toISOString();
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      startAt = tomorrow.toISOString();
    }

    const apptRes = await fetch(`${SQUARE_BASE}/bookings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        idempotency_key: `cbs-appt-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
        booking: {
          location_id: LOCATION_ID,
          start_at: startAt,
          customer_id: customerId,
          customer_note: `${plan}${notes ? ' | ' + notes : ''}`,
          seller_note: `Address: ${address}`,
          location_type: 'BUSINESS_LOCATION',
          appointment_segments: [{
            duration_minutes: 30,
            service_variation_id: SERVICE_VARIATION_ID,
            service_variation_version: SERVICE_VARIATION_VERSION,
            team_member_id: TEAM_MEMBER_ID
          }]
        }
      })
    });

    const apptData = await apptRes.json();
    if (apptData.errors) {
      console.error('Appointment error:', JSON.stringify(apptData.errors));
      return res.status(200).json({ success: true, customer_id: customerId, appointment_error: apptData.errors });
    }

    console.log('Appointment created:', apptData.booking?.id);
    return res.status(200).json({ success: true, customer_id: customerId, appointment_id: apptData.booking?.id });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
