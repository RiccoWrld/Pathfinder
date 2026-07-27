const { parseHistory } = require("../utils/chatHistory");

describe("parseHistory", () => {
  it("returns empty array for null history", () => {
    const result = parseHistory(null, "Hello");
    expect(result).toEqual([]);
  });

  it("returns empty array for empty array string", () => {
    const result = parseHistory("[]", "Hello");
    expect(result).toEqual([]);
  });

  it("filters to valid user/assistant messages only", () => {
    const history = JSON.stringify([
      { role: "user", content: "Hi" },
      { role: "system", content: "You are a bot" },
      { role: "assistant", content: "Hello" },
      { role: "tool", content: "result" },
    ]);
    const result = parseHistory(history, "How are you?");
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
  });

  it("deduplicates last message if it matches current", () => {
    const history = JSON.stringify([
      { role: "user", content: "What is my GPA?" },
    ]);
    const result = parseHistory(history, "What is my GPA?");
    expect(result).toHaveLength(0);
  });

  it("limits to 12 messages", () => {
    const history = JSON.stringify(
      Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i}`,
      }))
    );
    const result = parseHistory(history, "New message");
    expect(result.length).toBeLessThanOrEqual(12);
  });

  it("filters out empty content messages", () => {
    const history = JSON.stringify([
      { role: "user", content: "" },
      { role: "assistant", content: "Valid reply" },
    ]);
    const result = parseHistory(history, "Hello");
    expect(result).toHaveLength(1);
  });
});
