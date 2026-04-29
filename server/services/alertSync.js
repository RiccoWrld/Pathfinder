const pool = require("../db");
const { matchAdvisorFromAudit } = require("./advisorMatcher");

const addAuditAlert = async (
  client,
  { studentId, advisorId, category, priority, title, message, recommendedAction },
) => {
  await client.query(
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
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'audit')`,
    [studentId, advisorId, category, priority, title, message, recommendedAction],
  );
};

const syncAuditAlerts = async (studentId, auditSummary) => {
  const numericStudentId = Number(studentId);
  if (!Number.isInteger(numericStudentId) || numericStudentId <= 0 || !auditSummary) {
    return { synced: false, alertsCreated: 0 };
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const studentResult = await client.query(
      "SELECT advisor_id, university_id FROM students WHERE id = $1",
      [numericStudentId],
    );

    if (studentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return { synced: false, alertsCreated: 0 };
    }

    const matchedAdvisor = await matchAdvisorFromAudit(
      client,
      auditSummary,
      studentResult.rows[0].university_id,
    );
    const advisorId = matchedAdvisor?.id || studentResult.rows[0].advisor_id;

    if (matchedAdvisor) {
      await client.query(
        `UPDATE alerts
         SET advisor_id = $2
         WHERE student_id = $1
           AND is_resolved = false`,
        [numericStudentId, advisorId],
      );
    }

    await client.query(
      `UPDATE alerts
       SET is_resolved = true,
           status = 'resolved',
           resolved_at = COALESCE(resolved_at, NOW())
       WHERE student_id = $1
         AND is_resolved = false
         AND source = 'audit'`,
      [numericStudentId],
    );

    if (auditSummary.is_good_standing && Number(auditSummary.overall_gpa) >= 2) {
      await client.query(
        `UPDATE alerts
         SET is_resolved = true,
             status = 'resolved',
             resolved_at = COALESCE(resolved_at, NOW())
         WHERE student_id = $1
           AND is_resolved = false
           AND category = 'academic'
           AND (
             title ILIKE '%GPA%'
             OR message ILIKE '%GPA%'
             OR message ILIKE '%academic risk%'
             OR message ILIKE '%good standing%'
           )`,
        [numericStudentId],
      );
    }

    await client.query(
      `UPDATE alerts
       SET is_resolved = true,
           status = 'resolved',
           resolved_at = COALESCE(resolved_at, NOW())
       WHERE student_id = $1
         AND is_resolved = false
         AND category = 'degree_requirement'
         AND COALESCE(source, '') <> 'audit'`,
      [numericStudentId],
    );

    await client.query(
      `UPDATE students
       SET gpa = COALESCE($2, gpa),
           status = $3,
           completion_rate = COALESCE($4, completion_rate),
           academic_standing = COALESCE($5, academic_standing),
           audit_university_name = COALESCE($6, audit_university_name),
           advisor_id = COALESCE($7, advisor_id),
           last_audit_uploaded_at = NOW()
       WHERE id = $1`,
      [
        numericStudentId,
        Number.isFinite(auditSummary.overall_gpa) ? auditSummary.overall_gpa : null,
        auditSummary.is_good_standing ? "good-standing" : "needs-review",
        Number.isFinite(auditSummary.completion_rate)
          ? auditSummary.completion_rate
          : null,
        auditSummary.academic_standing,
        auditSummary.university_name,
        matchedAdvisor?.id || null,
      ],
    );

    let alertsCreated = 0;

    if (!auditSummary.is_good_standing || Number(auditSummary.overall_gpa) < 2) {
      await addAuditAlert(client, {
        studentId: numericStudentId,
        advisorId,
        category: "academic",
        priority: "high",
        title: "Academic Standing Review",
        message: `Your audit indicates ${auditSummary.academic_standing || "an academic standing concern"}.`,
        recommendedAction: "Meet with your advisor to review GPA requirements and academic support options.",
      });
      alertsCreated++;
    }

    if (
      auditSummary.has_unmet_requirements ||
      auditSummary.has_in_progress ||
      auditSummary.is_nearly_complete ||
      (Number.isFinite(auditSummary.completion_rate) && auditSummary.completion_rate < 100)
    ) {
      await addAuditAlert(client, {
        studentId: numericStudentId,
        advisorId,
        category: "degree_requirement",
        priority: "medium",
        title: auditSummary.is_nearly_complete
          ? "Nearly Complete: Review In-Progress Requirements"
          : "Degree Progress Review",
        message: auditSummary.is_nearly_complete
          ? "Your DegreeWorks audit indicates you are nearly complete and should review in-progress requirements."
          : "Your DegreeWorks audit indicates remaining or in-progress degree requirements.",
        recommendedAction: "Review your DegreeWorks audit with your advisor before finalizing your next schedule.",
      });
      alertsCreated++;
    }

    await client.query("COMMIT");
    return {
      synced: true,
      alertsCreated,
      advisorMatched: Boolean(matchedAdvisor),
      advisorId,
      advisorName: matchedAdvisor?.name || null,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { syncAuditAlerts };
