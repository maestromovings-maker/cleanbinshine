const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID;
const SQUARE_BASE = 'https://connect.squareup.com/v2';

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
    // ── STEP 1: Create or find customer in Square ──
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const customerRes = await fetch(`${SQUARE_BASE}/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        idempotency_key: `cbs-customer-${Date.now()}-${email}`,
        given_name: firstName,
        family_name: lastName,
        email_address: email,
        phone_number: phone,
        address: { address_line_1: address },
        note: `Plan: ${plan} | Source: cleanbinshine.com`,
        reference_id: `CBS-${Date.now()}`
      })
    });

    const customerData = await customerRes.json();
    if (customerData.errors) {
      console.error('Square customer error:', customerData.errors);
    }
    const customerId = customerData.customer?.id;

    // ── STEP 2: Create appointment in Square ──
    // Parse preferred date or use tomorrow as default
    let startAt;
    if (preferred_date && preferred_date !== 'Flexible') {
      startAt = new Date(preferred_date + 'T09:00:00').toISOString();
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      startAt = tomorrow.toISOString();
    }

    // End time = start + 30 minutes
    const endAt = new Date(new Date(startAt).getTime() + 30 * 60000).toISOString();

    const apptBody = {
      idempotency_key: `cbs-appt-${Date.now()}`,
      appointment: {
        location_id: SQUARE_LOCATION_ID,
        start_at: startAt,
        end_at: endAt,
        customer_id: customerId || undefined,
        customer_note: `${plan}${notes ? ' | Notes: ' + notes : ''}`,
        seller_note: `Address: ${address} | Plan: ${plan}`,
        appointment_segments: [
          {
            duration_minutes: 30,
            service_variation_version: 1,
            team_member_id_filter: { any: [] }
          }
        ]
      }
    };

    const apptRes = await fetch(`${SQUARE_BASE}/bookings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(apptBody)
    });

    const apptData = await apptRes.json();

    if (apptData.errors) {
      // Appointment failed but don't block — log and continue
      console.error('Square appointment error:', JSON.stringify(apptData.errors));
      return res.status(200).json({
        success: true,
        customer_id: customerId,
        appointment_id: null,
        warning: 'Customer created but appointment scheduling needs manual confirmation'
      });
    }

    return res.status(200).json({
      success: true,
      customer_id: customerId,
      appointment_id: apptData.booking?.id
    });

  } catch (err) {
    console.error('Square API error:', err);
    return res.status(500).json({ error: 'Square integration error', detail: err.message });
  }
};
