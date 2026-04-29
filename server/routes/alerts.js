const express = require("express");
const pool = require("../db");

const router = express.Router();

router.post("/system/check-alerts", async (req, res) => {
  try {
    await pool.query(`
      INSERT INTO alerts (
        student_id,
        advisor_id,
        category,
        priority,
        title,
        message,
        recommended_action,
        source
      )
      SELECT
        id,
        advisor_id,
        'academic',
        'high',
        'GPA Below Good Standing',
        'Action Required: GPA is currently ' || gpa || '.',
        'Schedule a meeting with your advisor to review your course load and support options.',
        'system'
      FROM students WHERE gpa < 2.0
      AND id NOT IN (SELECT student_id FROM alerts WHERE is_resolved = false)
    `);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/alerts/:studentId", async (req, res) => {
  res.redirect(307, `/api/students/${req.params.studentId}/alerts`);
});

router.get("/students/:studentId/alerts", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM alerts
       WHERE student_id = $1 AND is_resolved = false
       ORDER BY
         CASE priority
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
           ELSE 4
         END,
         created_at DESC`,
      [req.params.studentId],
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/alerts", async (req, res) => {
  const {
    student_id,
    advisor_id,
    category = "general",
    priority = "medium",
    title,
    message,
    recommended_action,
    source = "manual",
  } = req.body;

  if (!student_id || !advisor_id || !message) {
    return res
      .status(400)
      .json({ error: "student_id, advisor_id, and message are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO alerts (
         student_id,
         advisor_id,
         category,
         priority,
         title,
         message,
         recommended_action,
         source
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        student_id,
        advisor_id,
        category,
        priority,
        title,
        message,
        recommended_action,
        source,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/alerts/:alertId/acknowledge", async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE alerts
       SET status = 'acknowledged',
           acknowledged_at = COALESCE(acknowledged_at, NOW())
       WHERE id = $1 AND is_resolved = false
       RETURNING *`,
      [req.params.alertId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Active alert not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/alerts/:alertId/resolve", async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE alerts
       SET status = 'resolved',
           is_resolved = true,
           resolved_at = COALESCE(resolved_at, NOW())
       WHERE id = $1
       RETURNING *`,
      [req.params.alertId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Alert not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
