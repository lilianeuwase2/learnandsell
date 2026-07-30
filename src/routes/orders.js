const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

/* ---------------------------------------------------------------------
   SIMULATED MOMO / AIRTEL MONEY PAYMENT ENGINE
   ---------------------------------------------------------------------
   No real telco call is made. But the *shape* of the flow matches a real
   "request to pay" integration so a real one can be dropped in later
   without changing anything else that talks to this route:

     1. checkout creates the order + a payment row with status 'pending'
        and a generated external reference (like a real MoMo/Airtel
        transaction id) — this is returned to the client immediately.
     2. the phone number is validated against the chosen provider's
        real Rwandan prefixes (MTN: 078/079, Airtel: 072/073). A mismatch
        or malformed number fails immediately, like a real gateway
        rejecting a bad MSISDN before it even reaches the subscriber.
     3. otherwise, confirmation is simulated asynchronously after a short
        delay (mimicking the subscriber approving the prompt on their
        phone) via GET /api/orders/:id/payment for the client to poll,
        exactly like a real integration's webhook/poll cycle.
------------------------------------------------------------------------ */

const PROVIDER_PREFIXES = {
  'MTN MoMo': ['078', '079'],
  'Airtel Money': ['072', '073'],
};

function validatePhoneForProvider(phone, provider) {
  const digits = String(phone || '').replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('250') ? digits.slice(3) : digits; // strip country code
  if (!/^\d{9,10}$/.test(local)) return { ok: false, reason: 'Enter a valid Rwandan phone number' };
  const normalized = local.length === 9 ? '0' + local : local;
  const prefix = normalized.slice(0, 3);
  const allowed = PROVIDER_PREFIXES[provider] || [];
  if (!allowed.includes(prefix)) {
    return { ok: false, reason: `That number doesn't look like a ${provider} line` };
  }
  return { ok: true, normalized };
}

function fakeExternalRef(provider) {
  const tag = provider === 'MTN MoMo' ? 'MOMO' : 'AIRTEL';
  return `${tag}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function confirmPaymentAfterDelay(paymentId, orderId, buyerId, delayMs = 2500) {
  setTimeout(async () => {
    try {
      const updated = await db.query(
        `UPDATE payments SET status='confirmed', confirmed_at=now() WHERE id=$1 AND status='pending' RETURNING *`,
        [paymentId]
      );
      if (updated.rows[0]) {
        await db.query('INSERT INTO notifications (user_id, text) VALUES ($1,$2)', [
          buyerId,
          `Payment confirmed for order #${orderId.slice(0, 8)} (simulated ${updated.rows[0].provider} approval).`,
        ]);
      }
    } catch (err) {
      console.error('Simulated payment confirmation failed:', err);
    }
  }, delayMs);
}

// POST /api/orders/checkout
// body: { items: [{productId, name, price}], method: 'MTN MoMo' | 'Airtel Money', phone }
router.post('/checkout', requireAuth, requireRole('buyer'), async (req, res) => {
  const { items, method = 'MTN MoMo', phone } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty' });
  }
  if (!['MTN MoMo', 'Airtel Money'].includes(method)) {
    return res.status(400).json({ error: 'method must be "MTN MoMo" or "Airtel Money"' });
  }

  const phoneCheck = validatePhoneForProvider(phone, method);
  const total = items.reduce((s, i) => s + Number(i.price), 0);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const order = (await client.query(
      `INSERT INTO orders (buyer_id, total_rwf, status) VALUES ($1,$2,'processing') RETURNING *`,
      [req.user.id, total]
    )).rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, name_snapshot, price_rwf) VALUES ($1,$2,$3,$4)`,
        [order.id, item.productId || null, item.name, Math.round(Number(item.price))]
      );
    }

    const externalRef = fakeExternalRef(method);
    const initialStatus = phoneCheck.ok ? 'pending' : 'failed';
    const payment = (await client.query(
      `INSERT INTO payments (order_id, provider, phone, status, external_ref, failure_reason)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [order.id, method, phone || null, initialStatus, externalRef, phoneCheck.ok ? null : phoneCheck.reason]
    )).rows[0];

    await client.query(
      'INSERT INTO notifications (user_id, text) VALUES ($1,$2)',
      [
        req.user.id,
        phoneCheck.ok
          ? `${method} request sent for order #${order.id.slice(0, 8)} — approve it on your phone to confirm.`
          : `${method} payment for order #${order.id.slice(0, 8)} failed: ${phoneCheck.reason}.`,
      ]
    );

    await client.query('COMMIT');

    if (phoneCheck.ok) confirmPaymentAfterDelay(payment.id, order.id, req.user.id);

    res.status(201).json({ order, payment, items });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Checkout failed' });
  } finally {
    client.release();
  }
});

// GET /api/orders/:id/payment - poll the simulated payment status (for a "waiting for approval" spinner)
router.get('/:id/payment', requireAuth, async (req, res) => {
  const payment = (await db.query('SELECT * FROM payments WHERE order_id=$1', [req.params.id])).rows[0];
  if (!payment) return res.status(404).json({ error: 'No payment found for this order' });
  res.json({ payment });
});

// POST /api/orders/:id/payment/retry - retry a failed simulated payment with a corrected phone number
router.post('/:id/payment/retry', requireAuth, requireRole('buyer'), async (req, res) => {
  const { phone } = req.body;
  const order = (await db.query('SELECT * FROM orders WHERE id=$1 AND buyer_id=$2', [req.params.id, req.user.id])).rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const existing = (await db.query('SELECT * FROM payments WHERE order_id=$1', [req.params.id])).rows[0];
  if (!existing || existing.status !== 'failed') {
    return res.status(400).json({ error: 'Only a failed payment can be retried' });
  }

  const phoneCheck = validatePhoneForProvider(phone, existing.provider);
  const updated = (await db.query(
    `UPDATE payments SET status=$1, phone=$2, failure_reason=$3, external_ref=$4
     WHERE id=$5 RETURNING *`,
    [
      phoneCheck.ok ? 'pending' : 'failed',
      phone,
      phoneCheck.ok ? null : phoneCheck.reason,
      fakeExternalRef(existing.provider),
      existing.id,
    ]
  )).rows[0];

  if (phoneCheck.ok) confirmPaymentAfterDelay(updated.id, order.id, req.user.id);

  res.json({ payment: updated });
});

// GET /api/orders/mine - buyer's own orders, with payment status
router.get('/mine', requireAuth, requireRole('buyer'), async (req, res) => {
  const orders = (await db.query(
    `SELECT o.*, pay.provider AS method, pay.status AS payment_status, pay.external_ref, pay.failure_reason
     FROM orders o LEFT JOIN payments pay ON pay.order_id = o.id
     WHERE o.buyer_id=$1 ORDER BY o.created_at DESC`,
    [req.user.id]
  )).rows;
  const items = (await db.query(
    `SELECT * FROM order_items WHERE order_id = ANY($1::uuid[])`,
    [orders.map(o => o.id)]
  )).rows;
  res.json({ orders: orders.map(o => ({ ...o, items: items.filter(i => i.order_id === o.id) })) });
});

// GET /api/orders/seller - orders containing products from the logged-in seller's shop
router.get('/seller', requireAuth, requireRole('learner'), async (req, res) => {
  const shop = (await db.query('SELECT id FROM shops WHERE owner_id=$1', [req.user.id])).rows[0];
  if (!shop) return res.json({ orders: [] });

  const result = await db.query(
    `SELECT DISTINCT o.*, pay.provider AS method, pay.status AS payment_status FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     LEFT JOIN payments pay ON pay.order_id = o.id
     WHERE p.shop_id = $1
     ORDER BY o.created_at DESC`,
    [shop.id]
  );
  const orders = result.rows;
  const items = (await db.query(
    `SELECT oi.* FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE p.shop_id = $1`,
    [shop.id]
  )).rows;
  res.json({ orders: orders.map(o => ({ ...o, items: items.filter(i => i.order_id === o.id) })) });
});

// PATCH /api/orders/:id/advance - seller moves order to next fulfilment stage
// (only once payment is confirmed — mirrors a real shop never shipping an unpaid order)
router.patch('/:id/advance', requireAuth, requireRole('learner'), async (req, res) => {
  const stages = ['processing', 'shipped', 'completed'];
  const order = (await db.query('SELECT * FROM orders WHERE id=$1', [req.params.id])).rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const payment = (await db.query('SELECT * FROM payments WHERE order_id=$1', [req.params.id])).rows[0];
  if (!payment || payment.status !== 'confirmed') {
    return res.status(409).json({ error: 'Payment has not been confirmed yet for this order' });
  }

  const idx = stages.indexOf(order.status);
  if (idx === stages.length - 1) return res.json({ order });
  const nextStatus = stages[idx + 1];

  const updated = (await db.query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING *', [nextStatus, req.params.id])).rows[0];

  await db.query('INSERT INTO notifications (user_id, text) VALUES ($1,$2)',
    [order.buyer_id, `Order #${order.id.slice(0, 8)} moved to ${nextStatus}.`]);

  res.json({ order: updated });
});

module.exports = router;
