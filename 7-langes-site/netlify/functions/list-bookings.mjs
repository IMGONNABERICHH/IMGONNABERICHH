// Reads the booking requests back out of Netlify Forms so the studio page can
// show them, instead of you digging through email to find a client's details.
//
// Needs one more environment variable alongside the Stripe ones:
//   NETLIFY_API_TOKEN   a personal access token from Netlify → User settings →
//                       Applications → New access token
//
// SITE_ID is provided by Netlify automatically; NETLIFY_SITE_ID is honoured too
// in case you ever run this somewhere it isn't set for you.

const API = 'https://api.netlify.com/api/v1';
const FORM_NAME = 'booking';
const MAX = 50;

async function netlify(path) {
  const res = await fetch(`${API}/${path}`, {
    headers: { Authorization: `Bearer ${process.env.NETLIFY_API_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Netlify API ${path} → ${res.status}`);
  return res.json();
}

/* Submissions arrive as loose key/value data; pull out the fields the studio
   actually acts on and leave the rest alone. */
function shape(sub) {
  const d = sub.data || {};
  return {
    id: sub.id,
    receivedAt: sub.created_at,
    name: d.name || '',
    email: d.email || '',
    phone: d.phone || '',
    organization: d.organization || '',
    sessionType: d.session_type || '',
    date: d.booking_date || '',
    time: (d.booking_time || '').replace(/\s*PT$/, ''),
    when: d.booking_when || '',
    budget: d.budget || '',
    location: d.location || '',
    project: d.project || '',
  };
}

export default async (req) => {
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  if (!process.env.STUDIO_KEY)
    return json({ error: 'Server is missing STUDIO_KEY.' }, 500);

  if (req.headers.get('x-studio-key') !== process.env.STUDIO_KEY)
    return json({ error: 'Not authorised.' }, 401);

  if (!process.env.NETLIFY_API_TOKEN)
    return json({ error: 'Add a NETLIFY_API_TOKEN environment variable to list bookings.' }, 500);

  const siteId = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  if (!siteId) return json({ error: 'No SITE_ID available.' }, 500);

  try {
    const forms = await netlify(`sites/${siteId}/forms`);
    const form = forms.find(f => f.name === FORM_NAME);

    // No form yet just means nothing has been submitted since the deploy —
    // that is an empty list, not a failure.
    if (!form) return json({ bookings: [], note: 'No booking form registered yet.' });

    const subs = await netlify(`forms/${form.id}/submissions?per_page=${MAX}`);

    const bookings = subs
      .map(shape)
      .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

    return json({ bookings });
  } catch (err) {
    return json({ error: err.message }, 502);
  }
};
