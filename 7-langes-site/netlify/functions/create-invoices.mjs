// Turns a confirmed booking into two Stripe invoices: 50% to lock the date,
// and the balance due 72 hours before the shoot. Both accept card, Apple Pay,
// Google Pay and ACH bank transfer.
//
// Runs only after the studio has confirmed the date — that is the whole point
// of doing it here rather than at booking time. Nothing charges a client for a
// slot that turned out to be taken.
//
// Needs two environment variables set in Netlify → Site configuration →
// Environment variables:
//   STRIPE_SECRET_KEY   sk_live_… (or sk_test_… while you are trying it out)
//   STUDIO_KEY          any long random string — the password on studio.html
//
// The secret key lives here and never reaches the browser.

const STRIPE = 'https://api.stripe.com/v1';
const PAY_METHODS = ['card', 'us_bank_account'];   // card covers Apple/Google Pay
const BALANCE_DUE_HOURS = 72;                      // before the shoot starts

/* Stripe wants form encoding, including for nested keys like
   payment_settings[payment_method_types][0]. */
function encode(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => out.append(`${key}[${i}]`, item));
    else if (typeof v === 'object') encode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe(path, body, idempotencyKey) {
  const headers = {
    Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await fetch(`${STRIPE}/${path}`, {
    method: 'POST',
    headers,
    body: body ? encode(body).toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `Stripe ${path} failed`);
  return json;
}

/* ── Pacific wall-clock → real instant, matching the booking page ── */
function zoneOffset(ts) {
  const p = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(ts))) if (part.type !== 'literal') p[part.type] = +part.value;
  if (p.hour === 24) p.hour = 0;
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ts / 60000) * 60000;
}

function studioInstant(dateStr, hh, mi) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mi);
  let ts = wall;
  for (let i = 0; i < 2; i++) ts = wall - zoneOffset(ts);
  return ts;
}

/* "10:00 AM" → { hh, mi } */
function parseTime(label) {
  const m = String(label).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return { hh: 10, mi: 0 };
  let hh = +m[1] % 12;
  if (/PM/i.test(m[3])) hh += 12;
  return { hh, mi: +m[2] };
}

const money = cents => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });

export default async (req) => {
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STUDIO_KEY)
    return json({ error: 'Server is missing STRIPE_SECRET_KEY or STUDIO_KEY.' }, 500);

  // Only the studio can raise invoices — this endpoint is public otherwise.
  if (req.headers.get('x-studio-key') !== process.env.STUDIO_KEY)
    return json({ error: 'Not authorised.' }, 401);

  let payload;
  try { payload = await req.json(); } catch { return json({ error: 'Bad JSON.' }, 400); }

  const { clientName, clientEmail, sessionType, shootDate, shootTime, totalDollars } = payload;

  if (!clientEmail || !shootDate || !totalDollars)
    return json({ error: 'Client email, shoot date and total are all required.' }, 400);

  const total = Math.round(Number(totalDollars) * 100);
  if (!Number.isFinite(total) || total <= 0)
    return json({ error: 'Total must be a positive number.' }, 400);

  // Split so the two halves always add back to the total, odd cents included.
  const deposit = Math.round(total / 2);
  const balance = total - deposit;

  const { hh, mi } = parseTime(shootTime);
  const shootAt = studioInstant(shootDate, hh, mi);
  const balanceDue = Math.floor((shootAt - BALANCE_DUE_HOURS * 3600e3) / 1000);
  const nowSec = Math.floor(Date.now() / 1000);

  // A shoot inside 72 hours has no room for a staged balance — bill it in full.
  const singlePayment = balanceDue <= nowSec + 3600;

  const describe = label =>
    `${sessionType || 'Session'} — ${shootDate}${shootTime ? ' at ' + shootTime + ' PT' : ''} — ${label}`;

  // Same booking submitted twice must not raise four invoices.
  const fingerprint = [clientEmail, sessionType, shootDate, shootTime, total].join('|');

  try {
    const customer = await stripe('customers', {
      email: clientEmail,
      name: clientName || undefined,
      metadata: { shoot_date: shootDate, session_type: sessionType || '' },
    }, 'cust:' + fingerprint);

    const makeInvoice = async (amount, label, dueDate, tag) => {
      const invoice = await stripe('invoices', {
        customer: customer.id,
        collection_method: 'send_invoice',
        due_date: dueDate,
        description: describe(label),
        payment_settings: { payment_method_types: PAY_METHODS },
        metadata: { shoot_date: shootDate, session_type: sessionType || '', part: tag },
        auto_advance: false,
      }, `inv:${tag}:${fingerprint}`);

      await stripe('invoiceitems', {
        customer: customer.id,
        invoice: invoice.id,
        amount,
        currency: 'usd',
        description: describe(label),
      }, `item:${tag}:${fingerprint}`);

      // send finalises the invoice and emails the client a hosted payment page
      return stripe(`invoices/${invoice.id}/send`, null, `send:${tag}:${fingerprint}`);
    };

    if (singlePayment) {
      const only = await makeInvoice(total, 'due in full', nowSec + 86400, 'full');
      return json({
        ok: true,
        singlePayment: true,
        note: `Shoot is inside ${BALANCE_DUE_HOURS} hours, so this is one invoice for the full amount.`,
        invoices: [{ label: 'Full amount', amount: money(total), url: only.hosted_invoice_url }],
      });
    }

    const dep = await makeInvoice(deposit, '50% deposit to lock the date', nowSec + 86400, 'deposit');
    const bal = await makeInvoice(balance, `balance, due ${BALANCE_DUE_HOURS}h before the shoot`, balanceDue, 'balance');

    return json({
      ok: true,
      invoices: [
        { label: 'Deposit (50%)', amount: money(deposit), url: dep.hosted_invoice_url },
        {
          label: 'Balance', amount: money(balance), url: bal.hosted_invoice_url,
          due: new Date(balanceDue * 1000).toLocaleString('en-US', {
            timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short',
          }) + ' PT',
        },
      ],
    });
  } catch (err) {
    return json({ error: err.message }, 502);
  }
};
