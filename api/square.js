const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
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
    // ── Get location ──
    const locRes = await fetch(`${SQUARE_BASE}/locations`, { headers });
    const locData = await locRes.json();
    const location = locData.locations?.find(l => l.name === 'Clean Bin Shine') || locData.locations?.[0];
    const locationId = location?.id;
    console.log('Location:', locationId);

    // ── Get team member services to find correct variation ID ──
    const tmRes = await fetch(`${SQUARE_BASE}/bookings/team-member-booking-profiles?limit=10`, { headers });
    const tmData = await tmRes.json();
    console.log('Team member profiles:', JSON.stringify(tmData).substr(0, 500));

    // ── Get catalog with APPOINTMENTS type ──
    const catRes = await fetch(`${SQUARE_BASE}/catalog/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        object_types: ['ITEM'],
        query: { prefix_query: { attribute_name: 'name', attribute_prefix: 'bin' } }
      })
    });
    const catData = await catRes.json();
    console.log('Catalog search:', JSON.stringify(catData).substr(0, 500));

    let serviceVariationId = null;
    let serviceVariationVersion = null;

    if (catData.objects?.length > 0) {
      const item = catData.objects[0];
      const variation = item.item_data?.variations?.[0];
      if (variation) {
        serviceVariationId = variation.id;
        serviceVariationVersion = variation.version;
        console.log('Service variation ID:', serviceVariationId, 'version:', serviceVariationVersion);
      }
    }

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
    console.log('Customer:', customerId);

    if (!serviceVariationId) {
      console.log('No service found - creating customer only');
      return res.status(200).json({ success: true, customer_id: customerId, warning: 'No service variation found' });
    }

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
          location_id: locationId,
          start_at: startAt,
          customer_id: customerId,
          customer_note: `${plan}${notes ? ' | ' + notes : ''}`,
          seller_note: `Address: ${address}`,
          location_type: 'BUSINESS_LOCATION',
          appointment_segments: [{
            duration_minutes: 30,
            service_variation_id: serviceVariationId,
            service_variation_version: serviceVariationVersion,
            team_member_id: 'TMdp7ZBmdSzVu5XF'
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
