const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// GET /api/admin/overview
router.get('/overview', async (req, res) => {
  const [users, courses, products, orders] = await Promise.all([
    db.query('SELECT count(*) FROM users'),
    db.query('SELECT count(*) FROM courses'),
    db.query('SELECT count(*) FROM products'),
    db.query('SELECT count(*) FROM orders'),
  ]);
  res.json({
    users: Number(users.rows[0].count),
    courses: Number(courses.rows[0].count),
    products: Number(products.rows[0].count),
    orders: Number(orders.rows[0].count),
  });
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const result = await db.query('SELECT id, name, contact, role, language, active, created_at FROM users ORDER BY created_at DESC');
  res.json({ users: result.rows });
});

// PATCH /api/admin/users/:id/toggle-active
router.patch('/users/:id/toggle-active', async (req, res) => {
  const result = await db.query(
    'UPDATE users SET active = NOT active WHERE id=$1 RETURNING id, name, active',
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
  const u = result.rows[0];
  await db.query('INSERT INTO notifications (user_id, text) VALUES ($1,$2)',
    [u.id, `Your account was ${u.active ? 'reactivated' : 'suspended'} by an admin.`]);
  res.json({ user: u });
});

// GET /api/admin/products
router.get('/products', async (req, res) => {
  const result = await db.query(
    `SELECT p.*, s.name AS shop_name FROM products p JOIN shops s ON s.id = p.shop_id ORDER BY p.created_at DESC`
  );
  res.json({ products: result.rows });
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', async (req, res) => {
  await db.query('DELETE FROM products WHERE id=$1', [req.params.id]);
  res.status(204).end();
});

// GET /api/admin/reports
router.get('/reports', async (req, res) => {
  const enrollment = await db.query(
    `SELECT c.name, count(e.id) AS active
     FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id AND e.quiz_passed = false
     GROUP BY c.name`
  );
  const sales = await db.query(
    `SELECT count(*) AS total_orders,
            count(*) FILTER (WHERE status='completed') AS completed_orders,
            COALESCE(SUM(total_rwf),0) AS total_sales_rwf
     FROM orders`
  );
  res.json({ enrollmentByCourse: enrollment.rows, sales: sales.rows[0] });
});

module.exports = router;
