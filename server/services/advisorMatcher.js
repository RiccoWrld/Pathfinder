const normalizePersonName = (name = "") => {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\b(dr|prof|professor|mr|mrs|ms)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

module.exports = { matchAdvisorFromAudit };
