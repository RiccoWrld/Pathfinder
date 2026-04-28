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
const pdf = require("pdf-parse");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const upload = multer({ storage: multer.memoryStorage() });



const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

app.get("/", (req, res) => {
  res.send("Pathfinder Server is live and operational!");
});

app.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      success: true,
      message: "Database connection successful!",
      timestamp: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/system/check-alerts", async(req, res) => {
  try{
    const gpaAlerts = await pool.query(`
  INSERT INTO alerts (student_id, advisor_id, message, category)
  SELECT id, advisor_id, 'Action Required: GPA is currently ' || gpa || '. Schedule an advisor meeting.', 'academic'
  FROM students
  WHERE gpa < 2.0
  AND id NOT IN (SELECT student_id FROM alerts WHERE is_resolved = false)
`);

      res.json({ success: true, message: "Alert engine proccessed successfully." });
  }
  catch (err) {
    res.status(500).json({ error: err.message})
  }
})

app.patch("/api/alerts/:id", async (req, res) => {
  const {id } = req.params;
  const { is_resolved } = req.body;
  try {
    await pool.query(
      "UPDATE alerts SET is_resolved = $1 WHERE id = $2",
      [is_resolved, id]
    );
    res.json({ success: true });
    
  }
  catch (err) {
    res.status(500).json({ error: err.message})
  }
});

app.get("/api/alerts/:studentId", async (req, res) => {
  try {
    // FIX: Remove the curly braces around studentId
    const studentId = req.params.studentId; 
    
    const result = await pool.query(
      "SELECT * FROM alerts WHERE student_id = $1 AND is_resolved = false ORDER BY created_at DESC",
      [studentId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({ error: "Internal Server Error"});
  }
});

app.get("/api/universities", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM universities ORDER BY name ASC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  const { email, password, role, university_id } = req.body;
  try {
    // Hash the password so it's not stored in plain text
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      "INSERT INTO users (email, password_hash, role, university_id) VALUES ($1, $2, $3, $4) RETURNING id, email, role",
      [email, passwordHash, role, university_id]
    );

    res.json(newUser.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "User already exists or database error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (user.rows.length === 0) {
      return res.status(401).json({ error: "Invalid Credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid Credentials" });
    }

    // Create a secure token (Session)
    const token = jwt.sign(
      { userId: user.rows[0].id, role: user.rows[0].role, universityId: user.rows[0].university_id },
      "your_jwt_secret", // In production, move this to .env
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        id: user.rows[0].id,
        role: user.rows[0].role,
        university_id: user.rows[0].university_id
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("api/ai/advisor", upload.single("file"), async (req, res) => {
  const { message, history } = req.body;
  let context = "";

  try {
    if (req.file) {
      const data = await pdf(req.file.buffer);
      context = `Student's DegreeWorks Data: ${data.text}`;
    }
    const model = genAI.getGenerativeModel({ model: "gemini-3.0-flash" });

    const prompt =`
      You are the Pathfinder AI Academic Advisor. 
      Use the following context (DegreeWorks) to answer student questions accurately. 
      If no context is provided, answer general academic questions.
      
      ${context}
      
      User Question: ${message}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ reply: response.text() });
  }
  catch (err) {
    res.status(500).json({ error: "AI Advisor is currently offline." });
  }
})

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
