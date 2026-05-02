let requirementProgressColumnsReady = false;

const ensureRequirementProgressColumns = async (db) => {
  if (requirementProgressColumnsReady) return;

  await db.query(`
    ALTER TABLE students
      ADD COLUMN IF NOT EXISTS requirement_completed_count INT,
      ADD COLUMN IF NOT EXISTS requirement_in_progress_count INT,
      ADD COLUMN IF NOT EXISTS requirement_missing_count INT,
      ADD COLUMN IF NOT EXISTS requirement_total_count INT
  `);

  requirementProgressColumnsReady = true;
};

module.exports = { ensureRequirementProgressColumns };
