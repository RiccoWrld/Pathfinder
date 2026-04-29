const MAX_HISTORY_MESSAGES = 12;

const parseHistory = (rawHistory, currentMessage) => {
  if (!rawHistory) return [];

  try {
    const parsed = JSON.parse(rawHistory);
    if (!Array.isArray(parsed)) return [];

    const clean = parsed
      .filter((msg) => msg && (msg.role === "user" || msg.role === "assistant"))
      .map((msg) => ({
        role: msg.role,
        content: String(msg.content || "")
          .trim()
          .slice(0, 4000),
      }))
      .filter((msg) => msg.content);

    const lastMessage = clean[clean.length - 1];
    if (
      lastMessage?.role === "user" &&
      lastMessage.content === currentMessage
    ) {
      clean.pop();
    }

    return clean.slice(-MAX_HISTORY_MESSAGES);
  } catch (err) {
    console.error("Invalid chat history:", err);
    return [];
  }
};

module.exports = { parseHistory };
