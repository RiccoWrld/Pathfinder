const {
  normalizeAuditText,
  extractAuditSummary,
} = require("../services/auditParser");

describe("normalizeAuditText", () => {
  it("normalizes line endings", () => {
    const result = normalizeAuditText("hello\r\nworld\r");
    expect(result).toBe("hello\n\nworld");
  });

  it("trims whitespace", () => {
    const result = normalizeAuditText("  hello world  ");
    expect(result).toBe("hello world");
  });

  it("caps at 90000 characters", () => {
    const long = "a".repeat(100000);
    const result = normalizeAuditText(long);
    expect(result.length).toBe(90000);
  });
});

describe("extractAuditSummary", () => {
  it("returns empty object for empty text", () => {
    const result = extractAuditSummary("");
    expect(result).toEqual({});
  });

  it("returns empty object for null text", () => {
    const result = extractAuditSummary(null);
    expect(result).toEqual({});
  });

  it("extracts university name from institution header", () => {
    const text = "Institution: University of Testing\nSome other content";
    const result = extractAuditSummary(text);
    expect(result.university_name).toBe("University of Testing");
  });

  it("detects good standing", () => {
    const text = "Academic Standing     Good Standing";
    const result = extractAuditSummary(text);
    expect(result.is_good_standing).toBe(true);
    expect(result.academic_standing).toBe("Good Standing");
  });

  it("detects academic probation", () => {
    const text = "Academic Standing     Probation";
    const result = extractAuditSummary(text);
    expect(result.is_good_standing).toBe(false);
    expect(result.academic_standing).toBe("Probation");
  });

  it("returns default progress values for empty audit", () => {
    const text = "Complete\nNot Complete\nStill Needed";
    const result = extractAuditSummary(text);
    expect(result).toHaveProperty("completion_rate");
    expect(result).toHaveProperty("missing_requirements");
    expect(result).toHaveProperty("requirement_progress");
  });
});
