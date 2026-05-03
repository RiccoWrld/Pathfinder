const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { ensureRequirementProgressColumns } = require("../services/schemaGuards");

const router = express.Router();

router.post("/register", async (req, res) => {
  // Legacy endpoint kept for compatibility with earlier local experiments.
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id",
      [username, hashedPassword],
    );
    res
      .status(201)
      .json({ message: "User registered", userId: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/auth/signup", async (req, res) => {
  const { email, password, role = "student", university_id, name } = req.body;
  // Normalize account fields before validation so duplicate checks are reliable.
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedRole = String(role || "student").trim().toLowerCase();
  const normalizedName = String(name || "").trim();

  if (!normalizedEmail || !password || !university_id) {
    return res
      .status(400)
      .json({ error: "email, password, and university_id are required" });
  }

  if (!["student", "advisor"].includes(normalizedRole)) {
    return res.status(400).json({ error: "role must be student or advisor" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Create the base login record first, then attach the role-specific profile.
    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, university_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role, university_id`,
      [normalizedEmail, hashedPassword, normalizedRole, university_id],
    );

    const user = userResult.rows[0];
    // If no name is provided, make a readable profile name from the email prefix.
    const profileName =
      normalizedName ||
      normalizedEmail
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
    let studentId = null;
    let advisorId = null;

    if (normalizedRole === "advisor") {
      // Advisor accounts get their own advisor profile for dashboard ownership.
      const advisorResult = await client.query(
        `INSERT INTO advisors (name, email, university_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [profileName, normalizedEmail, university_id],
      );
      advisorId = advisorResult.rows[0].id;
    }

    if (normalizedRole === "student") {
      // New students are assigned to the first advisor at their university when available.
      const advisorResult = await client.query(
        `SELECT id
         FROM advisors
         WHERE university_id = $1
         ORDER BY id
         LIMIT 1`,
        [university_id],
      );
      advisorId = advisorResult.rows[0]?.id || null;

      const studentResult = await client.query(
        `INSERT INTO students (name, email, advisor_id, university_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [profileName, normalizedEmail, advisorId, university_id],
      );
      studentId = studentResult.rows[0].id;
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "User registered",
      user: {
        ...user,
        student_id: studentId,
        advisor_id: advisorId,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");

    if (err.code === "23505") {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    // Make sure older databases can support the latest dashboard fields.
    await ensureRequirementProgressColumns(pool);

    // The joins return everything the frontend needs to choose the right dashboard.
    const user = await pool.query(
      `SELECT
         users.*,
         students.id AS student_id,
         students.name AS student_name,
         students.advisor_id AS student_advisor_id,
         students.gpa AS student_gpa,
         students.status AS student_status,
         students.completion_rate AS student_completion_rate,
         students.academic_standing AS student_academic_standing,
         students.last_audit_uploaded_at AS student_last_audit_uploaded_at,
         students.requirement_completed_count AS student_requirement_completed_count,
         students.requirement_in_progress_count AS student_requirement_in_progress_count,
         students.requirement_missing_count AS student_requirement_missing_count,
         students.requirement_total_count AS student_requirement_total_count,
         advisors.id AS advisor_profile_id,
         advisors.name AS advisor_name,
         COALESCE(students.audit_university_name, user_universities.name, advisor_universities.name, email_universities.name, student_universities.name) AS university_name,
         COALESCE(user_universities.domain, advisor_universities.domain, email_universities.domain, student_universities.domain) AS university_domain
       FROM users
       LEFT JOIN students
         ON LOWER(students.email) = LOWER(users.email)
       LEFT JOIN advisors
         ON LOWER(advisors.email) = LOWER(users.email)
       LEFT JOIN universities AS user_universities
         ON user_universities.id = users.university_id
       LEFT JOIN universities AS advisor_universities
         ON advisor_universities.id = advisors.university_id
       LEFT JOIN universities AS email_universities
         ON LOWER($1) LIKE '%@' || LOWER(email_universities.domain)
       LEFT JOIN universities AS student_universities
         ON student_universities.id = students.university_id
       WHERE users.email = $1
       ORDER BY CASE
         WHEN user_universities.id IS NOT NULL THEN 0
         WHEN advisor_universities.id IS NOT NULL THEN 1
         WHEN student_universities.id IS NOT NULL THEN 2
         WHEN email_universities.id IS NOT NULL THEN 3
         ELSE 4
       END
       LIMIT 1`,
      [email],
    );
    if (user.rows.length === 0)
      return res.status(401).json({ error: "Invalid Credentials" });

    const isMatch = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!isMatch) return res.status(401).json({ error: "Invalid Credentials" });

    const token = jwt.sign(
      { userId: user.rows[0].id, role: user.rows[0].role },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "24h" },
    );
    res.json({
      token,
      user: {
        id: user.rows[0].id,
        email: user.rows[0].email,
        role: user.rows[0].role,
        university_id: user.rows[0].university_id,
        university_name: user.rows[0].university_name,
        university_domain: user.rows[0].university_domain,
        student_id: user.rows[0].student_id,
        student_name: user.rows[0].student_name,
        advisor_id: user.rows[0].advisor_profile_id || user.rows[0].student_advisor_id,
        advisor_name: user.rows[0].advisor_name,
        gpa: user.rows[0].student_gpa,
        status:
          user.rows[0].student_academic_standing || user.rows[0].student_status,
        completion_rate: user.rows[0].student_completion_rate,
        requirement_progress: user.rows[0].student_requirement_total_count
          ? {
              completed: user.rows[0].student_requirement_completed_count || 0,
              in_progress: user.rows[0].student_requirement_in_progress_count || 0,
              missing: user.rows[0].student_requirement_missing_count || 0,
              total: user.rows[0].student_requirement_total_count || 0,
            }
          : null,
        last_audit_uploaded_at: user.rows[0].student_last_audit_uploaded_at,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
