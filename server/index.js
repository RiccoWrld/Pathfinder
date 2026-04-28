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
const { PDFDocument } = require("pdf-lib");
const pdfParse = require("pdf-parse-fork"); // For reading text inside PDFs

// --- 1. AI CLIENT CONFIGURATION ---

const API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(API_KEY);

// Latest stable production model per your documentation
const _MODEL_NAME = "gemini-2.5-flash"; 

const _systemPrompt = () => {
  return (
    "You are a University Faculty Advisor. Your goal is to help students graduate on time. " +
    "Use the provided student document data (transcripts, audits) to give accurate guidance. " +
    "Be professional, encouraging, and if you are unsure of specific data, suggest contacting the department office."
  );
};

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// --- 2. CORE & AUTHENTICATION ROUTES ---

app.get("/", (req, res) => res.send("Pathfinder Universal Server Operational"));

app.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ success: true, timestamp: result.rows[0].now });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) return res.status(401).json({ error: "Invalid Credentials" });

    const isMatch = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!isMatch) return res.status(401).json({ error: "Invalid Credentials" });

    const token = jwt.sign(
      { userId: user.rows[0].id, role: user.rows[0].role },
      process.env.JWT_SECRET || "your_jwt_secret", { expiresIn: "24h" }
    );
    res.json({ token, user: { id: user.rows[0].id, role: user.rows[0].role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 3. ACADEMIC ALERT ROUTES ---

app.post("/api/system/check-alerts", async (req, res) => {
  try {
    await pool.query(`
      INSERT INTO alerts (student_id, advisor_id, message, category)
      SELECT id, advisor_id, 'Action Required: GPA is currently ' || gpa || '.', 'academic'
      FROM students WHERE gpa < 2.0
      AND id NOT IN (SELECT student_id FROM alerts WHERE is_resolved = false)
    `);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/alerts/:studentId", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM alerts WHERE student_id = $1 AND is_resolved = false ORDER BY created_at DESC",
      [req.params.studentId]
    );
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: "Internal Server Error" }); }
});

// --- 4. AI ADVISOR ROUTE (TEXT EXTRACTION + 2.5 FLASH) ---

const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/ai/advisor", upload.single("file"), async (req, res) => {
  const { message, history = [] } = req.body;
  let pdfTextContext = "";

  try {
    if (req.file) {
      // Extract text so the AI can actually "see" the data
      const data = await pdfParse(req.file.buffer);
      pdfTextContext = `\n[EXTRACTED TEXT FROM STUDENT DOCUMENT]:\n${data.text}`;
    }

    const model = genAI.getGenerativeModel({ model: _MODEL_NAME });

    // Build contents structure (Python-style logic)
    const contents = [{ role: "user", parts: [{ text: _systemPrompt() }] }];

    if (pdfTextContext) {
      contents.push({
        role: "user",
        parts: [{ text: "Context from student file:" + pdfTextContext }]
      });
    }

    // Add conversation history
    history.forEach(msg => {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }]
      });
    });

    contents.push({ role: "user", parts: [{ text: message }] });

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
        if (err.status === 429) { // Fixes Quota issues
          attempts++;
          await sleep(2000 * attempts);
        } else { throw err; }
      }
    }

    if (!success) throw new Error("Processing failed.");
    res.json({ reply: textResponse });

  } catch (err) {
    console.error("AI Error:", err);
    res.status(500).json({ 
      error: "I'm sorry, I'm having trouble processing that request. Please try again or contact your advisor.",
      details: err.message 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));