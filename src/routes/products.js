const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/products - marketplace listing, with optional filters
// query: category, search, maxPrice
router.get('/', async (req, res) => {
  const { category, search, maxPrice } = req.query;
  const clauses = ['p.in_stock = true'];
  const params = [];

  if (category && category !== 'All') {
    params.push(category);
    clauses.push(`p.category = $${params.length}`);
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    clauses.push(`LOWER(p.name) LIKE $${params.length}`);
  }
  if (maxPrice) {
    params.push(Number(maxPrice));
    clauses.push(`p.price_rwf <= $${params.length}`);
  }

  const sql = `
    SELECT p.*, s.name AS shop_name,
      COALESCE(AVG(r.rating), 0)::numeric(10,1) AS avg_rating,
      COUNT(r.id) AS review_count
    FROM products p
    JOIN shops s ON s.id = p.shop_id
    LEFT JOIN reviews r ON r.product_name_snapshot = p.name
    WHERE ${clauses.join(' AND ')}
    GROUP BY p.id, s.name
    ORDER BY p.created_at DESC`;

  const result = await db.query(sql, params);
  res.json({ products: result.rows });
});

// GET /api/products/mine - the logged-in seller's own product list (any stock status)
router.get('/mine', requireAuth, requireRole('learner'), async (req, res) => {
  const shop = (await db.query('SELECT id FROM shops WHERE owner_id=$1', [req.user.id])).rows[0];
  if (!shop) return res.json({ products: [] });
  const result = await db.query('SELECT * FROM products WHERE shop_id=$1 ORDER BY created_at DESC', [shop.id]);
  res.json({ products: result.rows });
});

async function getOwnShopOrFail(userId) {
  const shop = (await db.query('SELECT * FROM shops WHERE owner_id=$1', [userId])).rows[0];
  if (!shop) throw Object.assign(new Error('You need a shop first'), { status: 403 });
  return shop;
}

// POST /api/products
router.post('/', requireAuth, requireRole('learner'), async (req, res) => {
  try {
    const shop = await getOwnShopOrFail(req.user.id);
    const { name, price, description = '', imageUrl = null } = req.body;
    if (!name || price === undefined) return res.status(400).json({ error: 'name and price are required' });

    const result = await db.query(
      `INSERT INTO products (shop_id, name, description, category, image_url, price_rwf)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [shop.id, name, description, shop.category, imageUrl, Math.round(Number(price))]
    );
    await db.query('INSERT INTO notifications (user_id, text) VALUES ($1,$2)',
      [req.user.id, `Product "${name}" was listed in your shop.`]);
    res.status(201).json({ product: result.rows[0] });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PUT /api/products/:id
router.put('/:id', requireAuth, requireRole('learner'), async (req, res) => {
  const shop = await getOwnShopOrFail(req.user.id).catch(() => null);
  const { name, price, description, imageUrl } = req.body;
  const result = await db.query(
    `UPDATE products SET
       name = COALESCE($1, name),
       price_rwf = COALESCE($2, price_rwf),
       description = COALESCE($3, description),
       image_url = COALESCE($4, image_url)
     WHERE id=$5 AND shop_id=$6 RETURNING *`,
    [name, price !== undefined ? Math.round(Number(price)) : null, description, imageUrl, req.params.id, shop && shop.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Product not found in your shop' });
  await db.query('INSERT INTO notifications (user_id, text) VALUES ($1,$2)',
    [req.user.id, `Product "${result.rows[0].name}" was updated.`]);
  res.json({ product: result.rows[0] });
});

// PATCH /api/products/:id/stock - toggle in/out of stock
router.patch('/:id/stock', requireAuth, requireRole('learner'), async (req, res) => {
  const shop = await getOwnShopOrFail(req.user.id).catch(() => null);
  const result = await db.query(
    `UPDATE products SET in_stock = NOT in_stock WHERE id=$1 AND shop_id=$2 RETURNING *`,
    [req.params.id, shop && shop.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Product not found in your shop' });
  const p = result.rows[0];
  await db.query('INSERT INTO notifications (user_id, text) VALUES ($1,$2)',
    [req.user.id, `Product "${p.name}" marked as ${p.in_stock ? 'in stock' : 'out of stock'}.`]);
  res.json({ product: p });
});

// DELETE /api/products/:id
router.delete('/:id', requireAuth, requireRole('learner', 'admin'), async (req, res) => {
  let ownerFilter = '';
  const params = [req.params.id];
  if (req.user.role !== 'admin') {
    const shop = await getOwnShopOrFail(req.user.id).catch(() => null);
    if (!shop) return res.status(403).json({ error: 'You need a shop first' });
    ownerFilter = 'AND shop_id = $2';
    params.push(shop.id);
  }
  const result = await db.query(`DELETE FROM products WHERE id=$1 ${ownerFilter} RETURNING *`, params);
  if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.status(204).end();
});

module.exports = router;
