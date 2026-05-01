const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: 'Invalid JSON' };
  }

  const { email, code, password, name, action } = body;

  if (!email || !code || !action) {
    return { statusCode: 400, headers, body: 'Email, code, and action are required.' };
  }

  // Retrieve verification record
  const { data: records, error: lookupError } = await supabaseAdmin
    .from('email_verifications')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1);

  if (lookupError || records.length === 0) {
    return { statusCode: 400, headers, body: 'No verification code found.' };
  }

  const record = records[0];

  // Check expiration
  if (new Date(record.expires_at) < new Date()) {
    await supabaseAdmin.from('email_verifications').delete().eq('id', record.id);
    return { statusCode: 400, headers, body: 'Verification code expired.' };
  }

  // Check attempts (max 5)
  if (record.attempts >= 5) {
    await supabaseAdmin.from('email_verifications').delete().eq('id', record.id);
    return { statusCode: 400, headers, body: 'Too many attempts. Please request a new code.' };
  }

  // Increment attempts
  await supabaseAdmin
    .from('email_verifications')
    .update({ attempts: record.attempts + 1 })
    .eq('id', record.id);

  if (record.code !== code) {
    return { statusCode: 400, headers, body: 'Invalid verification code.' };
  }

  // Code is correct – clean up record
  await supabaseAdmin.from('email_verifications').delete().eq('id', record.id);

  // --- Action specific logic ---
  if (action === 'register') {
    if (!password || !name) {
      return { statusCode: 400, headers, body: 'Name and password are required for registration.' };
    }

    // Create user in Supabase Auth (confirmed immediately)
    const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (createError) {
      if (createError.message && createError.message.includes('already been registered')) {
        return { statusCode: 409, headers, body: 'A user with this email already exists.' };
      }
      return { statusCode: 500, headers, body: createError.message };
    }

    // Insert profile (the trigger may have already created one; upsert to be safe)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.user.id,
        full_name: name,
        role: 'user',
      }, { onConflict: 'id' });

    if (profileError) {
      return { statusCode: 500, headers, body: profileError.message };
    }

    return { statusCode: 200, headers, body: 'User registered and verified.' };
  }

  if (action === 'login') {
    // User already authenticated via password on the frontend.
    // This function is called only to confirm the 2FA code.
    return { statusCode: 200, headers, body: 'Code verified. Proceed.' };
  }

  return { statusCode: 400, headers, body: 'Invalid action.' };
};
