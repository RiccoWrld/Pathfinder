const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/universities", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, domain, branding_color FROM universities ORDER BY name ASC ",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
