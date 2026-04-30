const express = require("express");
const cors = require("cors");
require("dotenv").config();

const advisorRoutes = require("./routes/advisors");
const aiAdvisorRoutes = require("./routes/aiAdvisor");
const alertRoutes = require("./routes/alerts");
const authRoutes = require("./routes/auth");
const noteRoutes = require("./routes/notes");
const universityRoutes = require("./routes/universities");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", universityRoutes);
app.use("/api", authRoutes);
app.use("/api", alertRoutes);
app.use("/api", advisorRoutes);
app.use("/api", aiAdvisorRoutes);
app.use("/api", noteRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
