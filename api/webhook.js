// /api/webhook — receives and verifies Paddle payment notifications
//
// Requires PADDLE_WEBHOOK_SECRET in the environment (from Paddle:
// Developer Tools -> Notifications -> your destination -> secret key).
//
// CRITICAL: Paddle signs the exact raw request bytes — "timestamp:rawBody",
// HMAC-SHA256, compared against the h1 value in the Paddle-Signature header.
// Vercel's automatic JSON body parsing must be disabled for this route
// (see module.exports.config below), or the raw bytes we verify against
// won't match what Paddle actually signed, and every signature will fail.
//
// This is the ONLY source of truth for "did this payment really happen" —
// nothing on the frontend is trusted for that.

const crypto = require('crypto');
const { markSlugPaid, recordSubscriptionEvent } = require('../lib/db');

module.exports.config = {
  api: {
    bodyParser: false
  }
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function verifySignature(rawBody, header, secret) {
  if (!header) return false;
  const match = header.match(/^ts=(\d+);h1=([a-f0-9]+)$/);
  if (!match) return false;
  const [, timestamp, signature] = match;

  // Reject stale/replayed events — Paddle signs the timestamp precisely so
  // a captured request can't be re-sent later and still verify.
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;

  const signedPayload = `${timestamp}:${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false; // lengths differed, definitely not a match
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('PADDLE_WEBHOOK_SECRET is not set — cannot verify webhook');
    return res.status(500).end();
  }

  const rawBody = await readRawBody(req);
  const signatureHeader = req.headers['paddle-signature'];

  if (!verifySignature(rawBody, signatureHeader, secret)) {
    console.error('Rejected webhook: invalid or missing Paddle signature');
    return res.status(401).end();
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    return res.status(400).end();
  }

  try {
    const eventType = event.event_type;
    const data = event.data || {};

    if (eventType === 'transaction.completed') {
      const slug = data.custom_data?.slug;
      const priceId = data.items?.[0]?.price?.id;
      const customerEmail = data.customer?.email || null;
      if (slug) {
        await markSlugPaid(slug, { transactionId: data.id, priceId, customerEmail });
      }
    } else if (eventType === 'subscription.activated' || eventType === 'subscription.canceled') {
      await recordSubscriptionEvent({
        subscriptionId: data.id,
        status: eventType === 'subscription.activated' ? 'active' : 'canceled',
        priceId: data.items?.[0]?.price?.id,
        customerEmail: data.customer?.email || null
      });
    }
  } catch (err) {
    // We received and verified a genuine event but failed to fully process
    // it — still acknowledge with 200 so Paddle doesn't endlessly retry a
    // webhook that isn't actually broken on Paddle's end. Log for follow-up.
    console.error('Error processing verified Paddle webhook:', err.message);
  }

  return res.status(200).json({ received: true });
};
