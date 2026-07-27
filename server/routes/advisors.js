const express = require("express");
const pool = require("../db");
const { authorize } = require("../middleware/auth");
const { ensureRequirementProgressColumns } = require("../services/schemaGuards");
const { ensureCurrentProfileAlerts } = require("../services/alertSync");

const router = express.Router();

router.get("/advisors/:advisorId/alerts", async (req, res) => {
  try {
    await ensureCurrentProfileAlerts(pool, { advisorId: req.params.advisorId });

    // Advisor alert cards need both alert details and the student context.
    const result = await pool.query(
      `SELECT
         alerts.*,
         students.name AS student_name,
         students.email AS student_email,
         students.gpa AS student_gpa,
         students.status AS student_status
       FROM alerts
       JOIN students ON students.id = alerts.student_id
       WHERE alerts.advisor_id = $1 AND alerts.is_resolved = false
       ORDER BY
         CASE alerts.priority
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
           ELSE 4
         END,
         alerts.created_at DESC`,
      [req.params.advisorId],
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/advisors/:advisorId/students", async (req, res) => {
  try {
    // Older databases may not have the requirement progress columns yet.
    await ensureRequirementProgressColumns(pool);
    await ensureCurrentProfileAlerts(pool, { advisorId: req.params.advisorId });

    // Alert counts are calculated in SQL so the dashboard can sort by urgency.
    const result = await pool.query(
      `SELECT
         students.id,
         students.name,
         students.email,
         students.gpa,
         students.status,
         students.completion_rate,
         students.requirement_completed_count,
         students.requirement_in_progress_count,
         students.requirement_missing_count,
         students.requirement_total_count,
         students.academic_standing,
         students.last_audit_uploaded_at,
         students.audit_university_name,
         COUNT(alerts.id) FILTER (WHERE alerts.is_resolved = false) AS active_alert_count,
         COUNT(alerts.id) FILTER (
           WHERE alerts.is_resolved = false AND alerts.priority = 'high'
         ) AS high_priority_alert_count
       FROM students
       LEFT JOIN alerts
         ON alerts.student_id = students.id
       WHERE students.advisor_id = $1
       GROUP BY students.id
       ORDER BY
         COUNT(alerts.id) FILTER (
           WHERE alerts.is_resolved = false AND alerts.priority = 'high'
         ) DESC,
         COUNT(alerts.id) FILTER (WHERE alerts.is_resolved = false) DESC,
         students.name ASC`,
      [req.params.advisorId],
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
