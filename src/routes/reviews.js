const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/reviews - create or update (upsert) a review for a purchased product
router.post('/', requireAuth, requireRole('buyer'), async (req, res) => {
  const { orderId, productName, rating, comment = '' } = req.body;
  if (!orderId || !productName || !rating) {
    return res.status(400).json({ error: 'orderId, productName and rating are required' });
  }

  const order = (await db.query('SELECT * FROM orders WHERE id=$1 AND buyer_id=$2 AND status=$3', [orderId, req.user.id, 'completed'])).rows[0];
  if (!order) return res.status(403).json({ error: 'You can only review products from your own completed orders' });

  const result = await db.query(
    `INSERT INTO reviews (order_id, product_name_snapshot, buyer_id, rating, comment)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (order_id, product_name_snapshot, buyer_id)
     DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = now()
     RETURNING *`,
    [orderId, productName, req.user.id, rating, comment]
  );

  await db.query('INSERT INTO notifications (user_id, text) VALUES ($1,$2)',
    [req.user.id, `Review saved for "${productName}".`]);

  res.status(201).json({ review: result.rows[0] });
});

// GET /api/reviews/mine - all reviews the logged-in buyer has written (used to show "update review" vs "rate products")
router.get('/mine', requireAuth, requireRole('buyer'), async (req, res) => {
  const result = await db.query('SELECT * FROM reviews WHERE buyer_id=$1', [req.user.id]);
  res.json({ reviews: result.rows });
});

// GET /api/reviews?productName=...
router.get('/', async (req, res) => {
  const { productName } = req.query;
  if (!productName) return res.status(400).json({ error: 'productName query param is required' });
  const result = await db.query('SELECT * FROM reviews WHERE product_name_snapshot=$1 ORDER BY created_at DESC', [productName]);
  res.json({ reviews: result.rows });
});

module.exports = router;
