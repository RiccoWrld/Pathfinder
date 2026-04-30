const express = require("express");
const pool = require("../db");

const router = express.Router();

let notesTableReady = false;

const ensureNotesTable = async () => {
  if (notesTableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS advisor_notes (
      id SERIAL PRIMARY KEY,
      student_id INT REFERENCES students(id) ON DELETE CASCADE,
      advisor_id INT REFERENCES advisors(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  notesTableReady = true;
};

router.get("/students/:studentId/notes", async (req, res) => {
  const advisorId = Number(req.query.advisorId);

  try {
    await ensureNotesTable();

    const result = await pool.query(
      `SELECT
         advisor_notes.id,
         advisor_notes.student_id,
         advisor_notes.advisor_id,
         advisor_notes.note,
         advisor_notes.created_at,
         advisors.name AS advisor_name
       FROM advisor_notes
       LEFT JOIN advisors ON advisors.id = advisor_notes.advisor_id
       WHERE advisor_notes.student_id = $1
         AND ($2::int IS NULL OR advisor_notes.advisor_id = $2)
       ORDER BY advisor_notes.created_at DESC`,
      [req.params.studentId, Number.isInteger(advisorId) ? advisorId : null],
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/students/:studentId/notes", async (req, res) => {
  const { advisor_id, note } = req.body;
  const advisorId = Number(advisor_id);
  const studentId = Number(req.params.studentId);
  const cleanNote = String(note || "").trim();

  if (!Number.isInteger(advisorId) || !Number.isInteger(studentId) || !cleanNote) {
    return res.status(400).json({ error: "student_id, advisor_id, and note are required" });
  }

  if (cleanNote.length > 2000) {
    return res.status(400).json({ error: "Note must be 2000 characters or fewer" });
  }

  try {
    await ensureNotesTable();

    const studentResult = await pool.query(
      "SELECT id FROM students WHERE id = $1 AND advisor_id = $2",
      [studentId, advisorId],
    );

    if (studentResult.rows.length === 0) {
      return res.status(403).json({ error: "Student is not assigned to this advisor" });
    }

    const result = await pool.query(
      `INSERT INTO advisor_notes (student_id, advisor_id, note)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [studentId, advisorId, cleanNote],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/notes/:noteId", async (req, res) => {
  const advisorId = Number(req.query.advisorId);
  const noteId = Number(req.params.noteId);

  if (!Number.isInteger(advisorId) || !Number.isInteger(noteId)) {
    return res.status(400).json({ error: "noteId and advisorId are required" });
  }

  try {
    await ensureNotesTable();

    const result = await pool.query(
      `DELETE FROM advisor_notes
       WHERE id = $1 AND advisor_id = $2
       RETURNING id, student_id`,
      [noteId, advisorId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Note not found" });
    }

    res.json({ deleted: true, note: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
