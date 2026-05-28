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
    // ── STEP 1: Create customer ──
    // Format phone for Square: must be +1XXXXXXXXXX
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('1') ? '+' + cleanPhone : '+1' + cleanPhone;

    const nameParts = (name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const customerRes = await fetch(`${SQUARE_BASE}/customers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        idempotency_key: `cbs-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,
        given_name: firstName,
        family_name: lastName,
        email_address: email,
        phone_number: formattedPhone,
        note: `Plan: ${plan} | Source: cleanbinshine.com`,
        address: { address_line_1: address }
      })
    });

    const customerData = await customerRes.json();
    if (customerData.errors) {
      console.error('Customer error:', JSON.stringify(customerData.errors));
    }
    const customerId = customerData.customer?.id;
    console.log('Customer created:', customerId);

    // ── STEP 2: Look up Bin Cleaning service variation ID ──
    const catalogRes = await fetch(`${SQUARE_BASE}/catalog/list?types=ITEM`, { headers });
    const catalogData = await catalogRes.json();
    
    let serviceVariationId = null;
    if (catalogData.objects) {
      const binService = catalogData.objects.find(obj => 
        obj.type === 'ITEM' && 
        obj.item_data?.name?.toLowerCase().includes('bin cleaning')
      );
      if (binService && binService.item_data?.variations?.[0]) {
        serviceVariationId = binService.item_data.variations[0].id;
        console.log('Found service variation:', serviceVariationId);
      }
    }

    if (!serviceVariationId) {
      console.error('Bin Cleaning service not found in catalog');
      return res.status(200).json({ success: true, customer_id: customerId, warning: 'Service not found' });
    }

    // ── STEP 3: Create appointment ──
    console.log('Using location ID:', SQUARE_LOCATION_ID);
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
          location_id: SQUARE_LOCATION_ID,
          start_at: startAt,
          customer_id: customerId,
          customer_note: `${plan}${notes ? ' | ' + notes : ''}`,
          seller_note: `Address: ${address}`,
          location_type: 'BUSINESS_LOCATION',
          appointment_segments: [{
            duration_minutes: 30,
            service_variation_id: serviceVariationId,
            service_variation_version: 1,
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
    console.error('Square error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
