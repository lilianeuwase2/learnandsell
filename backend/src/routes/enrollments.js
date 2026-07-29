const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/enrollments/me - all of this learner's enrollments (dashboard + certificates)
router.get('/me', requireAuth, requireRole('learner'), async (req, res) => {
  const result = await db.query(
    `SELECT e.*, c.name as course_name, c.icon, c.duration
     FROM enrollments e JOIN courses c ON c.id = e.course_id
     WHERE e.user_id = $1 ORDER BY e.created_at`,
    [req.user.id]
  );
  res.json({ enrollments: result.rows });
});

// POST /api/enrollments - enroll in a course (only one active/unfinished course at a time)
router.post('/', requireAuth, requireRole('learner'), async (req, res) => {
  const { courseId } = req.body;
  if (!courseId) return res.status(400).json({ error: 'courseId is required' });

  const active = await db.query(
    `SELECT * FROM enrollments WHERE user_id = $1 AND quiz_passed = false`,
    [req.user.id]
  );
  if (active.rows.length && active.rows[0].course_id !== courseId) {
    return res.status(409).json({ error: "You're mid-course — finish it before starting another" });
  }

  const existing = await db.query('SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2', [req.user.id, courseId]);
  if (existing.rows.length) return res.json({ enrollment: existing.rows[0] });

  const result = await db.query(
    `INSERT INTO enrollments (user_id, course_id) VALUES ($1,$2) RETURNING *`,
    [req.user.id, courseId]
  );

  const course = (await db.query('SELECT name FROM courses WHERE id = $1', [courseId])).rows[0];
  await db.query('INSERT INTO notifications (user_id, text) VALUES ($1,$2)',
    [req.user.id, `Enrolled in ${course.name}. Start your first lesson.`]);

  res.status(201).json({ enrollment: result.rows[0] });
});

// POST /api/enrollments/:courseId/lessons/complete
router.post('/:courseId/lessons/complete', requireAuth, requireRole('learner'), async (req, res) => {
  const { courseId } = req.params;
  const enrollment = (await db.query('SELECT * FROM enrollments WHERE user_id=$1 AND course_id=$2', [req.user.id, courseId])).rows[0];
  if (!enrollment) return res.status(404).json({ error: 'Not enrolled in this course' });

  const totalLessons = (await db.query('SELECT count(*) FROM lessons WHERE course_id=$1', [courseId])).rows[0].count;
  if (enrollment.lessons_done >= totalLessons) return res.json({ enrollment });

  const updated = await db.query(
    'UPDATE enrollments SET lessons_done = lessons_done + 1 WHERE id=$1 RETURNING *',
    [enrollment.id]
  );

  const course = (await db.query('SELECT name FROM courses WHERE id=$1', [courseId])).rows[0];
  await db.query('INSERT INTO notifications (user_id, text) VALUES ($1,$2)',
    [req.user.id, `Lesson completed in ${course.name} (${updated.rows[0].lessons_done}/${totalLessons}).`]);

  res.json({ enrollment: updated.rows[0] });
});

// POST /api/enrollments/:courseId/quiz - submit an answer index
router.post('/:courseId/quiz', requireAuth, requireRole('learner'), async (req, res) => {
  const { courseId } = req.params;
  const { selectedIndex } = req.body;

  const quiz = (await db.query('SELECT * FROM quizzes WHERE course_id=$1', [courseId])).rows[0];
  if (!quiz) return res.status(404).json({ error: 'No quiz for this course' });

  const correct = selectedIndex === quiz.correct_index;
  if (!correct) return res.json({ correct: false });

  const updated = await db.query(
    `UPDATE enrollments SET quiz_passed = true, graduated_at = now()
     WHERE user_id=$1 AND course_id=$2 RETURNING *`,
    [req.user.id, courseId]
  );

  const course = (await db.query('SELECT name FROM courses WHERE id=$1', [courseId])).rows[0];
  await db.query('INSERT INTO notifications (user_id, text) VALUES ($1,$2)',
    [req.user.id, `Congratulations! You graduated from ${course.name} and your shop is now unlocked.`]);

  res.json({ correct: true, enrollment: updated.rows[0] });
});

module.exports = router;
