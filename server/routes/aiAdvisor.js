const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse-fork");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { extractAuditSummary, normalizeAuditText } = require("../services/auditParser");
const { syncAuditAlerts } = require("../services/alertSync");
const { parseHistory } = require("../utils/chatHistory");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const API_KEY = (process.env.GEMINI_API_KEY || "").trim();
const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL_NAME = "gemini-2.5-flash";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const systemPrompt = () => {
  // Keep this prompt strict because the model should not invent audit facts.
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
   - **Complete / [âœ”] / (MET)**: Requirements already satisfied.
   - **Still Needed / [ ]**: Missing requirements.

4. **In-Progress Logic:** Locate the "In-progress" section (usually at the end). List these as the student's current schedule.

### RESPONSE PROTOCOL
- When an audit is first uploaded, state the Classification, GPA, and Major if present.
- Use **BOLD** for all course codes (e.g., **COSC 458**).
- Keep answers concise, but include enough evidence that the student can verify the answer.
- For career guidance, start from what the audit shows, then offer a short practical path. Example: "Your audit shows a Computer Science major. For web development, prioritize course areas like databases, software engineering, web programming, human-computer interaction, networks, and a project or internship. I do not see exact catalog course numbers for all of those areas in the audit, so confirm the local options with your advisor."
`.trim();
};

router.post("/ai/advisor", upload.single("file"), async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({
        error: "Gemini API key is missing. Add GEMINI_API_KEY to the Docker .env file and restart Pathfinder.",
      });
    }

    const message = String(req.body.message || "Analyze my standing.").trim();
    const history = parseHistory(req.body.history, message);

    // Reuse the previous audit context unless the student uploads a fresh PDF.
    let auditContext = normalizeAuditText(req.body.auditContext || "");
    const uploadedAudit = Boolean(req.file);
    if (req.file) {
      const data = await pdfParse(req.file.buffer);
      auditContext = normalizeAuditText(data.text);
    }
    const auditSummary = extractAuditSummary(auditContext);
    // Only a new upload should sync alerts; normal chat follow-ups should not.
    const alertSync = uploadedAudit
      ? await syncAuditAlerts(req.body.studentId, auditSummary)
      : { synced: false, alertsCreated: 0 };

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: systemPrompt(),
    });

    const contents = [];

    // Seed the model conversation with the audit as source-of-truth context.
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

    // The final user turn repeats the grounding rules close to the question.
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
          // Gemini can throttle; a short retry keeps the chat from failing too eagerly.
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
    if (err.status === 401 || err.status === 403) {
      return res.status(503).json({
        error: "Gemini API key is missing or invalid. Update GEMINI_API_KEY in the Docker .env file and restart Pathfinder.",
      });
    }

    res.status(500).json({
      error: "Advisor is currently busy. Please try again in 30 seconds.",
    });
  }
});

module.exports = router;
