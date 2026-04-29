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

  return {
    completion_rate: completionRate,
    university_name: extractUniversityFromAudit(auditText),
  };
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
  const { email, password, role = "student", university_id } = req.body;

  if (!email || !password || !university_id) {
    return res
      .status(400)
      .json({ error: "email, password, and university_id are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, role, university_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role, university_id`,
      [email, hashedPassword, role, university_id],
    );

    res.status(201).json({ message: "User registered", user: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query(
      `SELECT
         users.*,
         universities.name AS university_name,
         universities.domain AS university_domain
       FROM users
       LEFT JOIN universities
         ON universities.id = users.university_id
         OR LOWER($1) LIKE '%@' || LOWER(universities.domain)
       WHERE users.email = $1
       ORDER BY CASE WHEN universities.id = users.university_id THEN 0 ELSE 1 END
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
    if (req.file) {
      const data = await pdfParse(req.file.buffer);
      auditContext = normalizeAuditText(data.text);
    }
    const auditSummary = extractAuditSummary(auditContext);

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
        if (err.status === 429) {
          attempts++;
          console.log(`Quota hit. Retrying in ${30 * attempts}s...`);
          await sleep(30000 * attempts);
        } else {
          throw err;
        }
      }
    }

    if (!success) throw new Error("API Limit Reached.");
    res.json({ reply: textResponse, auditContext, auditSummary });
  } catch (err) {
    console.error("AI Error:", err);
    res.status(500).json({
      error: "Advisor is currently busy. Please try again in 30 seconds.",
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
