const pool = require("../db");
const { matchAdvisorFromAudit } = require("./advisorMatcher");
const { ensureRequirementProgressColumns } = require("./schemaGuards");

const getAuditAlertKey = ({ category, title, message }) =>
  [category || "", title || "", message || ""].join("::");

const addAuditAlert = async (
  client,
  {
    studentId,
    advisorId,
    category,
    priority,
    title,
    message,
    recommendedAction,
    handledAuditAlertKeys = new Set(),
  },
) => {
  const activeDuplicate = await client.query(
    `SELECT id
     FROM alerts
     WHERE student_id = $1
       AND is_resolved = false
       AND source = 'audit'
       AND category = $2
       AND title = $3
       AND message = $4
     LIMIT 1`,
    [studentId, category, title, message],
  );

  // Keep an acknowledged current finding visible without adding a duplicate card.
  if (
    activeDuplicate.rows.length > 0 ||
    handledAuditAlertKeys.has(getAuditAlertKey({ category, title, message }))
  ) {
    return false;
  }

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

  return true;
};

const getProfileRequirementMessage = (student) => {
  const pieces = [];

  if (Number.isFinite(Number(student.completion_rate))) {
    pieces.push(`DegreeWorks shows ${student.completion_rate}% requirements complete`);
  }

  if (Number.isFinite(Number(student.requirement_missing_count)) && Number(student.requirement_missing_count) > 0) {
    pieces.push(`${student.requirement_missing_count} requirement item(s) still need review`);
  }

  return pieces.length > 0
    ? `${pieces.join(" and ")}.`
    : "DegreeWorks shows remaining requirements that still need advisor review.";
};

const ensureCurrentProfileAlerts = async (db, { studentId, advisorId } = {}) => {
  await ensureRequirementProgressColumns(db);

  const filters = [];
  const params = [];

  const numericStudentId = Number(studentId);
  const numericAdvisorId = Number(advisorId);

  if (Number.isInteger(numericStudentId) && numericStudentId > 0) {
    params.push(numericStudentId);
    filters.push(`students.id = $${params.length}`);
  }

  if (Number.isInteger(numericAdvisorId) && numericAdvisorId > 0) {
    params.push(numericAdvisorId);
    filters.push(`students.advisor_id = $${params.length}`);
  }

  const whereClause = filters.length > 0 ? `AND ${filters.join(" AND ")}` : "";
  const studentsResult = await db.query(
    `SELECT
       students.id,
       students.advisor_id,
       students.completion_rate,
       students.requirement_missing_count,
       students.academic_standing,
       students.status
     FROM students
     WHERE (
       COALESCE(students.requirement_missing_count, 0) > 0
       OR (
         students.completion_rate IS NOT NULL
         AND students.completion_rate < 100
       )
       OR LOWER(COALESCE(students.status, '')) IN ('needs-review', 'academic-risk')
     )
     ${whereClause}`,
    params,
  );

  let created = 0;

  for (const student of studentsResult.rows) {
    const activeRequirementAlert = await db.query(
      `SELECT id
       FROM alerts
       WHERE student_id = $1
         AND is_resolved = false
         AND category IN ('degree_requirement', 'course_requirement')
       LIMIT 1`,
      [student.id],
    );

    if (activeRequirementAlert.rows.length === 0) {
      const title = "DegreeWorks Requirements Need Review";
      const message = getProfileRequirementMessage(student);
      const handledResult = await db.query(
        `SELECT id
         FROM alerts
         WHERE student_id = $1
           AND category = 'degree_requirement'
           AND title = $2
           AND message = $3
           AND (
             is_resolved = true
             OR status IN ('acknowledged', 'resolved')
             OR acknowledged_at IS NOT NULL
             OR resolved_at IS NOT NULL
           )
         LIMIT 1`,
        [student.id, title, message],
      );

      if (handledResult.rows.length === 0) {
        await db.query(
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
           VALUES ($1, $2, 'degree_requirement', 'medium', $3, $4, $5, 'profile')`,
          [
            student.id,
            student.advisor_id,
            title,
            message,
            "Review the missing DegreeWorks requirements with your advisor before finalizing registration.",
          ],
        );
        created++;
      }
    }

    const standingNeedsReview =
      String(student.status || "").toLowerCase() === "needs-review" ||
      (
        student.academic_standing &&
        !String(student.academic_standing).toLowerCase().includes("good standing")
      );

    if (standingNeedsReview) {
      const activeAcademicAlert = await db.query(
        `SELECT id
         FROM alerts
         WHERE student_id = $1
           AND is_resolved = false
           AND category = 'academic'
         LIMIT 1`,
        [student.id],
      );

      if (activeAcademicAlert.rows.length === 0) {
        await db.query(
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
           VALUES ($1, $2, 'academic', 'high', 'Academic Standing Review', $3, $4, 'profile')`,
          [
            student.id,
            student.advisor_id,
            `Your audit indicates ${student.academic_standing || "an academic standing concern"}.`,
            "Meet with your advisor to review academic standing and support options.",
          ],
        );
        created++;
      }
    }
  }

  return created;
};

const syncAuditAlerts = async (studentId, auditSummary) => {
  const numericStudentId = Number(studentId);
  if (!Number.isInteger(numericStudentId) || numericStudentId <= 0 || !auditSummary) {
    return { synced: false, alertsCreated: 0 };
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureRequirementProgressColumns(client);

    // Pull the student's current advisor before trying to match a better one from the audit.
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

    // Current audit findings should be reflected on the dashboard even when a
    // previous upload produced similar resolved alerts. Active duplicates are
    // checked at insert time so acknowledged cards are not duplicated.
    const handledAuditAlertKeys = new Set();

    if (matchedAdvisor) {
      // If the audit names a known advisor, move active alerts to that advisor too.
      await client.query(
        `UPDATE alerts
         SET advisor_id = $2
         WHERE student_id = $1
           AND is_resolved = false`,
        [numericStudentId, advisorId],
      );
    }

    // Audit alerts are regenerated from the latest upload, so old unreviewed
    // audit alerts are resolved before the new set is inserted. Acknowledged
    // alerts stay active because the dashboards still need to show them.
    await client.query(
      `UPDATE alerts
       SET is_resolved = true,
           status = 'resolved',
           resolved_at = COALESCE(resolved_at, NOW())
       WHERE student_id = $1
         AND is_resolved = false
         AND source = 'audit'
         AND status <> 'acknowledged'`,
      [numericStudentId],
    );

    if (auditSummary.is_good_standing && Number(auditSummary.overall_gpa) >= 2) {
      // A clean audit should clear older GPA-risk alerts that no longer apply.
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

    // Replace the original seeded requirement warning once real audit data exists.
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

    // Keep the student profile aligned with the latest audit for both dashboards.
    await client.query(
      `UPDATE students
       SET gpa = COALESCE($2, gpa),
           status = $3,
           completion_rate = COALESCE($4, completion_rate),
           academic_standing = COALESCE($5, academic_standing),
           audit_university_name = COALESCE($6, audit_university_name),
           advisor_id = COALESCE($7, advisor_id),
           requirement_completed_count = COALESCE($8, requirement_completed_count),
           requirement_in_progress_count = COALESCE($9, requirement_in_progress_count),
           requirement_missing_count = COALESCE($10, requirement_missing_count),
           requirement_total_count = COALESCE($11, requirement_total_count),
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
        Number.isFinite(auditSummary.requirement_progress?.completed)
          ? auditSummary.requirement_progress.completed
          : null,
        Number.isFinite(auditSummary.requirement_progress?.in_progress)
          ? auditSummary.requirement_progress.in_progress
          : null,
        Number.isFinite(auditSummary.requirement_progress?.missing)
          ? auditSummary.requirement_progress.missing
          : null,
        Number.isFinite(auditSummary.requirement_progress?.total)
          ? auditSummary.requirement_progress.total
          : null,
      ],
    );

    let alertsCreated = 0;

    if (!auditSummary.is_good_standing || Number(auditSummary.overall_gpa) < 2) {
      // High-priority alert for academic standing issues.
      const created = await addAuditAlert(client, {
        studentId: numericStudentId,
        advisorId,
        category: "academic",
        priority: "high",
        title: "Academic Standing Review",
        message: `Your audit indicates ${auditSummary.academic_standing || "an academic standing concern"}.`,
        recommendedAction: "Meet with your advisor to review GPA requirements and academic support options.",
        handledAuditAlertKeys,
      });
      if (created) alertsCreated++;
    }

    if (
      auditSummary.has_unmet_requirements ||
      auditSummary.has_in_progress ||
      auditSummary.is_nearly_complete ||
      (Number.isFinite(auditSummary.completion_rate) && auditSummary.completion_rate < 100)
    ) {
      // General progress alert when the audit still shows unfinished work.
      const created = await addAuditAlert(client, {
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
        handledAuditAlertKeys,
      });
      if (created) alertsCreated++;
    }

    const missingRequirements = Array.isArray(auditSummary.missing_requirements)
      ? auditSummary.missing_requirements
      : [];

    for (const missingRequirement of missingRequirements) {
      const courseCode = missingRequirement.course_code;
      const requirement = missingRequirement.requirement || "a required course or requirement";

      // Specific missing-course alerts give students and advisors something concrete.
      const created = await addAuditAlert(client, {
        studentId: numericStudentId,
        advisorId,
        category: "course_requirement",
        priority: "medium",
        title: courseCode
          ? `Missing Course Requirement: ${courseCode}`
          : "Missing Course Requirement",
        message: courseCode
          ? `Your audit indicates ${courseCode} may still be needed for this requirement: ${requirement}.`
          : `Your audit indicates this requirement may still be needed: ${requirement}.`,
        recommendedAction: "Confirm this requirement with your advisor and include it in your next registration plan.",
        handledAuditAlertKeys,
      });
      if (created) alertsCreated++;
    }

    await client.query("COMMIT");
    return {
      synced: true,
      alertsCreated,
      missingRequirementAlerts: missingRequirements.length,
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

module.exports = { syncAuditAlerts, ensureCurrentProfileAlerts };
