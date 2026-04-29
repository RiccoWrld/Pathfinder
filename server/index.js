const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const pdfParse = require("pdf-parse-fork");

// --- 1. AI CONFIGURATION ---
const API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(API_KEY);
const _MODEL_NAME = "gemini-2.5-flash";

// --- 2. UNIVERSAL ACCURACY PROMPT ---
const _systemPrompt = () => {
  return `
### ROLE
You are Pathfinder's academic advisor. Your job is to answer student questions with two different modes:
- For audit-specific questions, use only the provided audit text and chat history.
- For career exploration, course-planning, and study guidance questions, provide helpful general academic guidance and clearly label it as guidance rather than audit data.

### GROUNDING RULES
- Treat the text inside CURRENT STUDENT AUDIT DATA as the source of truth.
- Do not guess, infer from common degree rules, or invent degree requirements.
- If an audit-specific answer is not clearly supported by the audit text, say: "I cannot locate that specific data in the provided audit."
- When you answer a factual question, include the exact audit detail that supports it.
- For course-specific answers, include course codes and grades exactly as they appear.
- Do not refuse career-path or course-planning questions only because the audit does not name that career path.
- For career-path questions, use the student's major, completed courses, in-progress courses, missing requirements, and GPA/classification from the audit when relevant. Then add general recommendations for course areas, electives, skills, projects, internships, and advisor questions.
- If you recommend courses for a career path, prefer exact course codes/titles only when they appear in the audit. Otherwise describe course areas such as web development, databases, software engineering, networks, security, UI/UX, cloud, or internships, and tell the student to confirm local course numbers with their catalog or advisor.

### UNIVERSAL EXTRACTION RULES (Source of Truth)
1. **Metadata Identification:** Locate these fields regardless of document position:
   - "Classification" or "Level": Determine if Student is Freshman, Sophomore, Junior, or Senior.
   - "GPA": Extract "Overall GPA" or "Cumulative GPA". (e.g., 3.579).
   - "Major": Identify the primary field of study.

2. **Tabular Data Parsing:** DegreeWorks uses a "Course / Title / Grade / Credits / Term" structure.
   - When asked for specific grades (e.g., "Courses I got a C in"), scan the "Grade" column ONLY. 
   - Verify the grade is an exact match to avoid confusing course titles (like "Calculus") with grades.

3. **Status Symbol Legend:**
   - **IP / REG / ( )**: In-Progress. These are CURRENT courses the student is taking NOW.
   - **Complete / [✔] / (MET)**: Requirements already satisfied.
   - **Still Needed / [ ]**: Missing requirements.

4. **In-Progress Logic:** Locate the "In-progress" section (usually at the end). List these as the student's current schedule.

### RESPONSE PROTOCOL
- When an audit is first uploaded, state the Classification, GPA, and Major if present.
- Use **BOLD** for all course codes (e.g., **COSC 458**).
- Keep answers concise, but include enough evidence that the student can verify the answer.
- For career guidance, start from what the audit shows, then offer a short practical path. Example: "Your audit shows a Computer Science major. For web development, prioritize course areas like databases, software engineering, web programming, human-computer interaction, networks, and a project or internship. I do not see exact catalog course numbers for all of those areas in the audit, so confirm the local options with your advisor."
`.trim();
};

// --- 3. DATABASE CONNECTION ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const upload = multer({ storage: multer.memoryStorage() });
const MAX_AUDIT_CONTEXT_CHARS = 90000;
const MAX_HISTORY_MESSAGES = 12;

const normalizeAuditText = (text = "") => {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_AUDIT_CONTEXT_CHARS);
};

const clampPercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
};

const extractPercentNear = (text, labels) => {
  for (const label of labels) {
    const regex = new RegExp(`${label}[^\\n%]{0,80}(\\d{1,3})(?:\\.\\d+)?\\s*%`, "i");
    const match = text.match(regex);
    const percent = clampPercent(match?.[1]);
    if (percent !== null) return percent;
  }

  return null;
};

const extractCreditCompletion = (text) => {
  const patterns = [
    {
      regex: /(?:credits?\s*(?:applied|earned|completed)|applied\s*credits?|earned\s*credits?|completed\s*credits?)[^\d]{0,30}(\d+(?:\.\d+)?)[^\n]{0,80}(?:credits?\s*(?:required|needed)|required\s*credits?|total\s*credits?)[^\d]{0,30}(\d+(?:\.\d+)?)/i,
      completedIndex: 1,
      requiredIndex: 2,
    },
    {
      regex: /(?:credits?\s*(?:required|needed)|required\s*credits?|total\s*credits?)[^\d]{0,30}(\d+(?:\.\d+)?)[^\n]{0,80}(?:credits?\s*(?:applied|earned|completed)|applied\s*credits?|earned\s*credits?|completed\s*credits?)[^\d]{0,30}(\d+(?:\.\d+)?)/i,
      completedIndex: 2,
      requiredIndex: 1,
    },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (!match) continue;

    const completed = Number(match[pattern.completedIndex]);
    const required = Number(match[pattern.requiredIndex]);
    if (!Number.isFinite(completed) || !Number.isFinite(required)) continue;

    if (required > 0 && completed <= required * 1.5) {
      return clampPercent((completed / required) * 100);
    }
  }

  return null;
};

const extractUniversityFromAudit = (text) => {
  const explicitMatch = text.match(
    /(?:university|institution|college|school)\s*(?:name)?\s*[:\-]\s*([^\n]+)/i,
  );
  if (explicitMatch?.[1]) {
    return explicitMatch[1].replace(/\s{2,}.*/, "").trim();
  }

  const headerLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) =>
      /\b(university|college|institute|school)\b/i.test(line) &&
      !/\b(major|department|course|requirement|catalog|audit|student)\b/i.test(line) &&
      line.length >= 6 &&
      line.length <= 90
    );

  return headerLine || null;
};

const cleanAuditLineValue = (value = "") => {
  return value
    .replace(/\s{2,}.*/, "")
    .replace(/\b(email|phone|office|campus|advisor)\b.*$/i, "")
    .trim();
};

const normalizePersonName = (name = "") => {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\b(dr|prof|professor|mr|mrs|ms)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const extractAdvisorFromAudit = (text = "") => {
  const advisorLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /\badvisor\b/i.test(line) && line.length <= 160);
  const advisorEmail = advisorLine?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;

  const advisorPatterns = [
    /(?:primary\s+)?(?:academic\s+)?advisor(?:\s+name)?\s*[:\-]\s*([^\n]+)/i,
    /(?:assigned\s+advisor|faculty\s+advisor|major\s+advisor)\s*[:\-]\s*([^\n]+)/i,
  ];

  for (const pattern of advisorPatterns) {
    const match = text.match(pattern);
    const advisorName = cleanAuditLineValue(match?.[1]);

    if (advisorName) {
      return { advisor_name: advisorName, advisor_email: advisorEmail };
    }
  }

  if (advisorLine) {
    const withoutEmail = advisorLine.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, "");
    const advisorName = cleanAuditLineValue(
      withoutEmail.replace(/.*?\badvisor(?:\s+name)?\b\s*[:\-]?\s*/i, ""),
    );

    if (advisorName && !/^advisor$/i.test(advisorName)) {
      return { advisor_name: advisorName, advisor_email: advisorEmail };
    }
  }

  return { advisor_name: null, advisor_email: advisorEmail };
};

const extractNumberAfter = (text, labels) => {
  for (const label of labels) {
    const regex = new RegExp(`${label}[^\\d]{0,40}(\\d+(?:\\.\\d+)?)`, "i");
    const match = text.match(regex);
    const value = Number(match?.[1]);
    if (Number.isFinite(value)) return value;
  }

  return null;
};

const extractAuditSummary = (auditText = "") => {
  if (!auditText) return {};

  const completionRate =
    extractPercentNear(auditText, [
      "degree\\s*progress",
      "overall\\s*progress",
      "completion",
      "percent\\s*complete",
      "progress",
    ]) ?? extractCreditCompletion(auditText);
  const overallGpa = extractNumberAfter(auditText, [
    "overall\\s*gpa",
    "cumulative\\s*gpa",
    "\\bGPA",
  ]);
  const standingMatch = auditText.match(/Academic Standing\s+([^\n]+)/i);
  const academicStanding = standingMatch?.[1]?.trim().replace(/\s{2,}.*/, "") || null;
  const isGoodStanding =
    /good standing/i.test(academicStanding || "") ||
    /you meet the minimum overall 2\.0 gpa/i.test(auditText);

  return {
    completion_rate: completionRate,
    university_name: extractUniversityFromAudit(auditText),
    ...extractAdvisorFromAudit(auditText),
    overall_gpa: overallGpa,
    academic_standing: academicStanding,
    is_good_standing: isGoodStanding,
    has_in_progress: /\bIN-PROGRESS\b|in-progress\s*credits/i.test(auditText),
    is_nearly_complete: /nearly complete/i.test(auditText),
    has_unmet_requirements: /still needed|not complete|unmet/i.test(auditText),
  };
};

const matchAdvisorFromAudit = async (client, auditSummary, universityId) => {
  const advisorEmail = auditSummary?.advisor_email;
  const advisorName = normalizePersonName(auditSummary?.advisor_name);

  if (advisorEmail) {
    const emailResult = await client.query(
      `SELECT id, name, email
       FROM advisors
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [advisorEmail],
    );

    if (emailResult.rows.length > 0) {
      return emailResult.rows[0];
    }
  }

  if (!advisorName) return null;

  const advisorResult = await client.query(
    `SELECT id, name, email
     FROM advisors
     WHERE ($1::int IS NULL OR university_id = $1)
     ORDER BY id`,
    [universityId],
  );

  return advisorResult.rows.find((advisor) => {
    const candidateName = normalizePersonName(advisor.name);
    return candidateName === advisorName || candidateName.includes(advisorName) || advisorName.includes(candidateName);
  }) || null;
};

const addAuditAlert = async (
  client,
  { studentId, advisorId, category, priority, title, message, recommendedAction },
) => {
  await client.query(
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
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'audit')`,
    [studentId, advisorId, category, priority, title, message, recommendedAction],
  );
};

const syncAuditAlerts = async (studentId, auditSummary) => {
  const numericStudentId = Number(studentId);
  if (!Number.isInteger(numericStudentId) || numericStudentId <= 0 || !auditSummary) {
    return { synced: false, alertsCreated: 0 };
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const studentResult = await client.query(
      "SELECT advisor_id, university_id FROM students WHERE id = $1",
      [numericStudentId],
    );

    if (studentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return { synced: false, alertsCreated: 0 };
    }

    const matchedAdvisor = await matchAdvisorFromAudit(
      client,
      auditSummary,
      studentResult.rows[0].university_id,
    );
    const advisorId = matchedAdvisor?.id || studentResult.rows[0].advisor_id;

    if (matchedAdvisor) {
      await client.query(
        `UPDATE alerts
         SET advisor_id = $2
         WHERE student_id = $1
           AND is_resolved = false`,
        [numericStudentId, advisorId],
      );
    }

    await client.query(
      `UPDATE alerts
       SET is_resolved = true,
           status = 'resolved',
           resolved_at = COALESCE(resolved_at, NOW())
       WHERE student_id = $1
         AND is_resolved = false
         AND source = 'audit'`,
      [numericStudentId],
    );

    if (auditSummary.is_good_standing && Number(auditSummary.overall_gpa) >= 2) {
      await client.query(
        `UPDATE alerts
         SET is_resolved = true,
             status = 'resolved',
             resolved_at = COALESCE(resolved_at, NOW())
         WHERE student_id = $1
           AND is_resolved = false
           AND category = 'academic'
           AND (
             title ILIKE '%GPA%'
             OR message ILIKE '%GPA%'
             OR message ILIKE '%academic risk%'
             OR message ILIKE '%good standing%'
           )`,
        [numericStudentId],
      );
    }

    await client.query(
      `UPDATE alerts
       SET is_resolved = true,
           status = 'resolved',
           resolved_at = COALESCE(resolved_at, NOW())
       WHERE student_id = $1
         AND is_resolved = false
         AND category = 'degree_requirement'
         AND COALESCE(source, '') <> 'audit'`,
      [numericStudentId],
    );

    await client.query(
      `UPDATE students
       SET gpa = COALESCE($2, gpa),
           status = $3,
           completion_rate = COALESCE($4, completion_rate),
           academic_standing = COALESCE($5, academic_standing),
           audit_university_name = COALESCE($6, audit_university_name),
           advisor_id = COALESCE($7, advisor_id),
           last_audit_uploaded_at = NOW()
       WHERE id = $1`,
      [
        numericStudentId,
        Number.isFinite(auditSummary.overall_gpa) ? auditSummary.overall_gpa : null,
        auditSummary.is_good_standing ? "good-standing" : "needs-review",
        Number.isFinite(auditSummary.completion_rate)
          ? auditSummary.completion_rate
          : null,
        auditSummary.academic_standing,
        auditSummary.university_name,
        matchedAdvisor?.id || null,
      ],
    );

    let alertsCreated = 0;

    if (!auditSummary.is_good_standing || Number(auditSummary.overall_gpa) < 2) {
      await addAuditAlert(client, {
        studentId: numericStudentId,
        advisorId,
        category: "academic",
        priority: "high",
        title: "Academic Standing Review",
        message: `Your audit indicates ${auditSummary.academic_standing || "an academic standing concern"}.`,
        recommendedAction: "Meet with your advisor to review GPA requirements and academic support options.",
      });
      alertsCreated++;
    }

    if (
      auditSummary.has_unmet_requirements ||
      auditSummary.has_in_progress ||
      auditSummary.is_nearly_complete ||
      (Number.isFinite(auditSummary.completion_rate) && auditSummary.completion_rate < 100)
    ) {
      await addAuditAlert(client, {
        studentId: numericStudentId,
        advisorId,
        category: "degree_requirement",
        priority: "medium",
        title: auditSummary.is_nearly_complete
          ? "Nearly Complete: Review In-Progress Requirements"
          : "Degree Progress Review",
        message: auditSummary.is_nearly_complete
          ? "Your DegreeWorks audit indicates you are nearly complete and should review in-progress requirements."
          : "Your DegreeWorks audit indicates remaining or in-progress degree requirements.",
        recommendedAction: "Review your DegreeWorks audit with your advisor before finalizing your next schedule.",
      });
      alertsCreated++;
    }

    await client.query("COMMIT");
    return {
      synced: true,
      alertsCreated,
      advisorMatched: Boolean(matchedAdvisor),
      advisorId,
      advisorName: matchedAdvisor?.name || null,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const parseHistory = (rawHistory, currentMessage) => {
  if (!rawHistory) return [];

  try {
    const parsed = JSON.parse(rawHistory);
    if (!Array.isArray(parsed)) return [];

    const clean = parsed
      .filter((msg) => msg && (msg.role === "user" || msg.role === "assistant"))
      .map((msg) => ({
        role: msg.role,
        content: String(msg.content || "")
          .trim()
          .slice(0, 4000),
      }))
      .filter((msg) => msg.content);

    const lastMessage = clean[clean.length - 1];
    if (
      lastMessage?.role === "user" &&
      lastMessage.content === currentMessage
    ) {
      clean.pop();
    }

    return clean.slice(-MAX_HISTORY_MESSAGES);
  } catch (err) {
    console.error("Invalid chat history:", err);
    return [];
  }
};

// --- Universities Route ---
app.get("/api/universities", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, domain, branding_color FROM universities ORDER BY name ASC ",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 4. AUTHENTICATION ROUTES ---

app.post("/api/register", async (req, res) => {
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

app.post("/api/auth/signup", async (req, res) => {
  const { email, password, role = "student", university_id, name } = req.body;
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

    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, university_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role, university_id`,
      [normalizedEmail, hashedPassword, normalizedRole, university_id],
    );

    const user = userResult.rows[0];
    const profileName =
      normalizedName ||
      normalizedEmail
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
    let studentId = null;
    let advisorId = null;

    if (normalizedRole === "advisor") {
      const advisorResult = await client.query(
        `INSERT INTO advisors (name, email, university_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [profileName, normalizedEmail, university_id],
      );
      advisorId = advisorResult.rows[0].id;
    }

    if (normalizedRole === "student") {
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

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
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
        last_audit_uploaded_at: user.rows[0].student_last_audit_uploaded_at,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 5. SYSTEM & ALERT ROUTES ---

app.post("/api/system/check-alerts", async (req, res) => {
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

app.get("/api/alerts/:studentId", async (req, res) => {
  res.redirect(307, `/api/students/${req.params.studentId}/alerts`);
});

app.get("/api/students/:studentId/alerts", async (req, res) => {
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

app.get("/api/advisors/:advisorId/alerts", async (req, res) => {
  try {
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

app.get("/api/advisors/:advisorId/students", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         students.id,
         students.name,
         students.email,
         students.gpa,
         students.status,
         students.completion_rate,
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

app.post("/api/alerts", async (req, res) => {
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

app.patch("/api/alerts/:alertId/acknowledge", async (req, res) => {
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

app.patch("/api/alerts/:alertId/resolve", async (req, res) => {
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

// --- 6. AI ADVISOR ROUTE (CORE LOGIC) ---

app.post("/api/ai/advisor", upload.single("file"), async (req, res) => {
  try {
    const message = String(req.body.message || "Analyze my standing.").trim();
    const history = parseHistory(req.body.history, message);

    let auditContext = normalizeAuditText(req.body.auditContext || "");
    const uploadedAudit = Boolean(req.file);
    if (req.file) {
      const data = await pdfParse(req.file.buffer);
      auditContext = normalizeAuditText(data.text);
    }
    const auditSummary = extractAuditSummary(auditContext);
    const alertSync = uploadedAudit
      ? await syncAuditAlerts(req.body.studentId, auditSummary)
      : { synced: false, alertsCreated: 0 };

    const model = genAI.getGenerativeModel({
      model: _MODEL_NAME,
      systemInstruction: _systemPrompt(),
    });

    const contents = [];

    if (auditContext) {
      contents.push({
        role: "user",
        parts: [
          {
            text: [
              "CURRENT STUDENT AUDIT DATA:",
              "Use this audit text as the source of truth for all academic answers.",
              auditContext,
            ].join("\n\n"),
          },
        ],
      });
      contents.push({
        role: "model",
        parts: [
          {
            text: "Audit data received. I will answer only from this audit text and identify missing data when needed.",
          },
        ],
      });
    } else {
      contents.push({
        role: "user",
        parts: [{ text: "No audit has been uploaded yet." }],
      });
      contents.push({
        role: "model",
        parts: [
          {
            text: "I need an audit PDF before I can answer audit-specific questions accurately.",
          },
        ],
      });
    }

    history.forEach((msg) => {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    });

    contents.push({
      role: "user",
      parts: [
        {
          text: [
            "Student question:",
            message,
            "",
            "Answer from CURRENT STUDENT AUDIT DATA when the question asks about this student's audit, requirements, grades, GPA, progress, or completed/in-progress courses.",
            "If the student asks for career exploration, suggested course areas, skills, projects, internships, or general planning, provide general guidance and use the audit only for available student context.",
            "Do not invent exact degree requirements or exact course codes that are not shown in the audit.",
          ].join("\n"),
        },
      ],
    });

    let attempts = 0;
    let success = false;
    let textResponse = "";

    while (attempts < 3 && !success) {
      try {
        const result = await model.generateContent({ contents });
        const response = await result.response;
        textResponse = response.text();
        success = true;
      } catch (err) {
        if (err.status === 429 || err.status === 503) {
          attempts++;
          const retryDelaySeconds = err.status === 503 ? 10 * attempts : 30 * attempts;
          console.log(
            `Gemini ${err.status} response. Retrying in ${retryDelaySeconds}s...`,
          );
          await sleep(retryDelaySeconds * 1000);
        } else {
          throw err;
        }
      }
    }

    if (!success) throw new Error("API Limit Reached.");
    res.json({ reply: textResponse, auditContext, auditSummary, alertSync });
  } catch (err) {
    console.error("AI Error:", err);
    res.status(500).json({
      error: "Advisor is currently busy. Please try again in 30 seconds.",
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
