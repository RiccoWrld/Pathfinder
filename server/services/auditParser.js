const MAX_AUDIT_CONTEXT_CHARS = 90000;

const normalizeAuditText = (text = "") => {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_AUDIT_CONTEXT_CHARS);
};

const clampPercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
};

const extractPercentNear = (text, labels) => {
  for (const label of labels) {
    const regex = new RegExp(`${label}[^\\n%]{0,80}(\\d{1,3})(?:\\.\\d+)?\\s*%`, "i");
    const match = text.match(regex);
    const percent = clampPercent(match?.[1]);
    if (percent !== null) return percent;
  }

  return null;
};

const extractCreditCompletion = (text) => {
  const patterns = [
    {
      regex: /(?:credits?\s*(?:applied|earned|completed)|applied\s*credits?|earned\s*credits?|completed\s*credits?)[^\d]{0,30}(\d+(?:\.\d+)?)[^\n]{0,80}(?:credits?\s*(?:required|needed)|required\s*credits?|total\s*credits?)[^\d]{0,30}(\d+(?:\.\d+)?)/i,
      completedIndex: 1,
      requiredIndex: 2,
    },
    {
      regex: /(?:credits?\s*(?:required|needed)|required\s*credits?|total\s*credits?)[^\d]{0,30}(\d+(?:\.\d+)?)[^\n]{0,80}(?:credits?\s*(?:applied|earned|completed)|applied\s*credits?|earned\s*credits?|completed\s*credits?)[^\d]{0,30}(\d+(?:\.\d+)?)/i,
      completedIndex: 2,
      requiredIndex: 1,
    },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (!match) continue;

    const completed = Number(match[pattern.completedIndex]);
    const required = Number(match[pattern.requiredIndex]);
    if (!Number.isFinite(completed) || !Number.isFinite(required)) continue;

    if (required > 0 && completed <= required * 1.5) {
      return clampPercent((completed / required) * 100);
    }
  }

  return null;
};

const extractUniversityFromAudit = (text) => {
  const explicitMatch = text.match(
    /(?:university|institution|college|school)\s*(?:name)?\s*[:\-]\s*([^\n]+)/i,
  );
  if (explicitMatch?.[1]) {
    return explicitMatch[1].replace(/\s{2,}.*/, "").trim();
  }

  const headerLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) =>
      /\b(university|college|institute|school)\b/i.test(line) &&
      !/\b(major|department|course|requirement|catalog|audit|student)\b/i.test(line) &&
      line.length >= 6 &&
      line.length <= 90
    );

  return headerLine || null;
};

const cleanAuditLineValue = (value = "") => {
  return value
    .replace(/\s{2,}.*/, "")
    .replace(/\b(email|phone|office|campus|advisor)\b.*$/i, "")
    .trim();
};

const extractAdvisorFromAudit = (text = "") => {
  const advisorLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /\badvisor\b/i.test(line) && line.length <= 160);
  const advisorEmail = advisorLine?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;

  const advisorPatterns = [
    /(?:primary\s+)?(?:academic\s+)?advisor(?:\s+name)?\s*[:\-]\s*([^\n]+)/i,
    /(?:assigned\s+advisor|faculty\s+advisor|major\s+advisor)\s*[:\-]\s*([^\n]+)/i,
  ];

  for (const pattern of advisorPatterns) {
    const match = text.match(pattern);
    const advisorName = cleanAuditLineValue(match?.[1]);

    if (advisorName) {
      return { advisor_name: advisorName, advisor_email: advisorEmail };
    }
  }

  if (advisorLine) {
    const withoutEmail = advisorLine.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, "");
    const advisorName = cleanAuditLineValue(
      withoutEmail.replace(/.*?\badvisor(?:\s+name)?\b\s*[:\-]?\s*/i, ""),
    );

    if (advisorName && !/^advisor$/i.test(advisorName)) {
      return { advisor_name: advisorName, advisor_email: advisorEmail };
    }
  }

  return { advisor_name: null, advisor_email: advisorEmail };
};

const extractNumberAfter = (text, labels) => {
  for (const label of labels) {
    const regex = new RegExp(`${label}[^\\d]{0,40}(\\d+(?:\\.\\d+)?)`, "i");
    const match = text.match(regex);
    const value = Number(match?.[1]);
    if (Number.isFinite(value)) return value;
  }

  return null;
};

const extractAuditSummary = (auditText = "") => {
  if (!auditText) return {};

  const completionRate =
    extractPercentNear(auditText, [
      "degree\\s*progress",
      "overall\\s*progress",
      "completion",
      "percent\\s*complete",
      "progress",
    ]) ?? extractCreditCompletion(auditText);
  const overallGpa = extractNumberAfter(auditText, [
    "overall\\s*gpa",
    "cumulative\\s*gpa",
    "\\bGPA",
  ]);
  const standingMatch = auditText.match(/Academic Standing\s+([^\n]+)/i);
  const academicStanding = standingMatch?.[1]?.trim().replace(/\s{2,}.*/, "") || null;
  const isGoodStanding =
    /good standing/i.test(academicStanding || "") ||
    /you meet the minimum overall 2\.0 gpa/i.test(auditText);

  return {
    completion_rate: completionRate,
    university_name: extractUniversityFromAudit(auditText),
    ...extractAdvisorFromAudit(auditText),
    overall_gpa: overallGpa,
    academic_standing: academicStanding,
    is_good_standing: isGoodStanding,
    has_in_progress: /\bIN-PROGRESS\b|in-progress\s*credits/i.test(auditText),
    is_nearly_complete: /nearly complete/i.test(auditText),
    has_unmet_requirements: /still needed|not complete|unmet/i.test(auditText),
  };
};

module.exports = { extractAuditSummary, normalizeAuditText };
