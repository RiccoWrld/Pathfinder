const MAX_HISTORY_MESSAGES = 12;

const parseHistory = (rawHistory, currentMessage) => {
  if (!rawHistory) return [];

  try {
    const parsed = JSON.parse(rawHistory);
    if (!Array.isArray(parsed)) return [];

    // Keep only short, valid chat turns so the model prompt stays manageable.
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
    // The current message is sent separately at the end of the prompt.
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
