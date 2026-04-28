const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

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
    const resuult = await pool.query("SELECT NOW()");
    res.json({
      success: true,
      message: "Database connection successful!",
      timestamp: resuult.rows[0].now,
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


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
