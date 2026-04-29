import React, { useState, useEffect, useRef } from 'react';
import './AIChat.css';

const AIChat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [hasAudit, setHasAudit] = useState(false);
  const [auditContext, setAuditContext] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() && !file) return;

    const currentInput = input.trim();
    const currentFile = file;
    const userMessage = {
      role: 'user',
      content: currentInput || `Audit uploaded: ${currentFile.name}`,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setFile(null);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("message", currentInput || "Please audit my progress.");
    formData.append("history", JSON.stringify(nextMessages));
    formData.append("auditContext", auditContext);
    if (currentFile) formData.append("file", currentFile);

    try {
      const response = await fetch("http://localhost:5000/api/ai/advisor", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Advisor request failed");
      }

      if (data.auditContext) {
        setAuditContext(data.auditContext);
        setHasAudit(true);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Error connecting to advisor." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pathfinder-chat-container">
      <div className="pathfinder-chat-window">
        {messages.map((msg, idx) => (
          <div key={idx} className={`pathfinder-bubble ${msg.role}`}>
            <div className="pathfinder-sender">{msg.role === 'user' ? 'Student' : 'Advisor'}</div>
            <div className="pathfinder-content">{msg.content}</div>
          </div>
        ))}
        {isLoading && <div className="pathfinder-bubble assistant loading">Advisor is analyzing your audit...</div>}
        <div ref={messagesEndRef} />
      </div>

      <form className="pathfinder-input-form" onSubmit={handleSubmit}>
        <div className="pathfinder-controls">
          <label className="pathfinder-file-btn">
            <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files[0])} hidden />
            {file ? "✅" : "📎"}
          </label>
          <input
            className="pathfinder-text-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasAudit ? "Ask follow-up questions..." : "Upload your audit PDF..."}
            disabled={isLoading}
          />
          <button className="pathfinder-send-btn" type="submit" disabled={isLoading}>Send</button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;
