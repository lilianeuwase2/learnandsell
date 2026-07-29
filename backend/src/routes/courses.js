const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/courses - full catalogue with lessons + quiz
router.get('/', async (req, res) => {
  const courses = (await db.query('SELECT * FROM courses ORDER BY created_at')).rows;
  const lessons = (await db.query('SELECT * FROM lessons ORDER BY order_index')).rows;
  const quizzes = (await db.query('SELECT * FROM quizzes')).rows;

  const shaped = courses.map(c => ({
    id: c.id, name: c.name, icon: c.icon, color: c.color,
    duration: c.duration, description: c.description,
    lessons: lessons.filter(l => l.course_id === c.id).map(l => ({ id: l.id, title: l.title })),
    quiz: (() => {
      const q = quizzes.find(q => q.course_id === c.id);
      // never leak the correct answer to the client
      return q ? { id: q.id, question: q.question, options: q.options } : null;
    })(),
  }));
  res.json({ courses: shaped });
});

// POST /api/courses - admin only
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, duration, description = '', icon = '🧶', color = 'pill-blue', lessons = [], quiz } = req.body;
  if (!name || !duration) return res.status(400).json({ error: 'name and duration are required' });

  const result = await db.query(
    `INSERT INTO courses (name, icon, color, duration, description) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, icon, color, duration, description]
  );
  const course = result.rows[0];

  const lessonTitles = lessons.length ? lessons : ['Introduction', 'Core technique', 'Practice project', 'Finishing touches'];
  for (let i = 0; i < lessonTitles.length; i++) {
    await db.query('INSERT INTO lessons (course_id, title, order_index) VALUES ($1,$2,$3)', [course.id, lessonTitles[i], i]);
  }

  const q = quiz || { question: 'Quick check', options: ['Follow the steps carefully', 'Skip steps to finish faster', 'Ignore instructions'], correct: 0 };
  await db.query(
    'INSERT INTO quizzes (course_id, question, options, correct_index) VALUES ($1,$2,$3,$4)',
    [course.id, q.question, JSON.stringify(q.options), q.correct]
  );

  res.status(201).json({ course });
});

// DELETE /api/courses/:id - admin only
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.query('DELETE FROM courses WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
