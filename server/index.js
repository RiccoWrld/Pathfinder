const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { authenticate, authorize } = require("./middleware/auth");
const { authLimiter, apiLimiter, aiLimiter } = require("./middleware/rateLimiter");

const advisorRoutes = require("./routes/advisors");
const aiAdvisorRoutes = require("./routes/aiAdvisor");
const alertRoutes = require("./routes/alerts");
const authRoutes = require("./routes/auth");
const noteRoutes = require("./routes/notes");
const universityRoutes = require("./routes/universities");

const app = express();

// The React app is served separately during development, so CORS stays open here.
app.use(cors());
app.use(express.json());

// Rate limiting applied per-route group based on sensitivity.
app.use("/api", apiLimiter, universityRoutes);
app.use("/api", authLimiter, authRoutes);
app.use("/api", authenticate, apiLimiter, alertRoutes);
app.use("/api", authenticate, aiLimiter, aiAdvisorRoutes);
app.use("/api", authenticate, authorize("advisor"), apiLimiter, advisorRoutes);
app.use("/api", authenticate, apiLimiter, noteRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
