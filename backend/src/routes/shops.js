const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/shops/me
router.get('/me', requireAuth, requireRole('learner'), async (req, res) => {
  const shop = (await db.query('SELECT * FROM shops WHERE owner_id=$1', [req.user.id])).rows[0];
  res.json({ shop: shop || null });
});

// POST /api/shops - create shop, only once the learner has graduated at least one course
router.post('/', requireAuth, requireRole('learner'), async (req, res) => {
  const graduated = await db.query(
    'SELECT 1 FROM enrollments WHERE user_id=$1 AND graduated_at IS NOT NULL LIMIT 1',
    [req.user.id]
  );
  if (!graduated.rows.length) {
    return res.status(403).json({ error: 'Finish a course to unlock your shop' });
  }

  const existing = await db.query('SELECT * FROM shops WHERE owner_id=$1', [req.user.id]);
  if (existing.rows.length) return res.status(409).json({ error: 'You already have a shop' });

  const { name, description = '', category, momoProvider = 'MTN MoMo', momoNumber } = req.body;
  if (!name || !category || !momoNumber) {
    return res.status(400).json({ error: 'name, category and momoNumber are required' });
  }

  const result = await db.query(
    `INSERT INTO shops (owner_id, name, description, category, momo_provider, momo_number)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.id, name, description, category, momoProvider, momoNumber]
  );

  await db.query('INSERT INTO notifications (user_id, text) VALUES ($1,$2)',
    [req.user.id, `Shop "${name}" created and linked to ${momoProvider}.`]);

  res.status(201).json({ shop: result.rows[0] });
});

// GET /api/shops/me/earnings - available balance = completed sales minus payouts already made
router.get('/me/earnings', requireAuth, requireRole('learner'), async (req, res) => {
  const shop = (await db.query('SELECT * FROM shops WHERE owner_id=$1', [req.user.id])).rows[0];
  if (!shop) return res.json({ balanceRwf: 0 });

  const earned = (await db.query(
    `SELECT COALESCE(SUM(oi.price_rwf),0) AS total FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     JOIN orders o ON o.id = oi.order_id
     WHERE p.shop_id = $1 AND o.status = 'completed'`,
    [shop.id]
  )).rows[0].total;

  const paidOut = (await db.query(
    `SELECT COALESCE(SUM(amount_rwf),0) AS total FROM payouts WHERE shop_id=$1`,
    [shop.id]
  )).rows[0].total;

  res.json({ balanceRwf: Number(earned) - Number(paidOut) });
});

// POST /api/shops/me/payout - simulated payout request via the shop's linked MoMo/Airtel number
router.post('/me/payout', requireAuth, requireRole('learner'), async (req, res) => {
  const shop = (await db.query('SELECT * FROM shops WHERE owner_id=$1', [req.user.id])).rows[0];
  if (!shop) return res.status(403).json({ error: 'You need a shop first' });

  const earningsRes = await db.query(
    `SELECT COALESCE(SUM(oi.price_rwf),0) - (SELECT COALESCE(SUM(amount_rwf),0) FROM payouts WHERE shop_id=$1) AS balance
     FROM order_items oi JOIN products p ON p.id = oi.product_id JOIN orders o ON o.id = oi.order_id
     WHERE p.shop_id=$1 AND o.status='completed'`,
    [shop.id]
  );
  const balance = Number(earningsRes.rows[0].balance);
  if (balance <= 0) return res.status(400).json({ error: 'No completed-order balance to pay out yet' });

  const payout = (await db.query(
    `INSERT INTO payouts (shop_id, amount_rwf, momo_provider, status) VALUES ($1,$2,$3,'requested') RETURNING *`,
    [shop.id, balance, shop.momo_provider]
  )).rows[0];

  await db.query('INSERT INTO notifications (user_id, text) VALUES ($1,$2)',
    [req.user.id, `Payout request submitted: ${balance.toLocaleString()} RWF via ${shop.momo_provider} (simulated).`]);

  res.status(201).json({ payout });
});

module.exports = router;
