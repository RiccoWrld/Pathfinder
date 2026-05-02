import { useState, useEffect, useRef } from 'react';
import './AIChat.css';

const AIChat = ({ user, onStudentProfileUpdate, onAlertsSynced }) => {
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
    formData.append("studentId", user?.student_id || user?.id || "");
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

      if (data.auditSummary && onStudentProfileUpdate) {
        const profileUpdate = {};

        if (Number.isFinite(data.auditSummary.completion_rate)) {
          profileUpdate.completion_rate = data.auditSummary.completion_rate;
        }

        if (data.auditSummary.requirement_progress) {
          profileUpdate.requirement_progress = data.auditSummary.requirement_progress;
        }

        if (Array.isArray(data.auditSummary.missing_requirements)) {
          profileUpdate.missing_requirements = data.auditSummary.missing_requirements;
        }

        if (data.auditSummary.university_name) {
          profileUpdate.university_name = data.auditSummary.university_name;
        }

        if (Number.isFinite(data.auditSummary.overall_gpa)) {
          profileUpdate.gpa = data.auditSummary.overall_gpa;
        }

        if (data.auditSummary.academic_standing) {
          profileUpdate.status = data.auditSummary.academic_standing;
        }

        if (data.alertSync?.synced) {
          profileUpdate.last_audit_uploaded_at = new Date().toISOString();
        }

        if (data.alertSync?.advisorMatched) {
          profileUpdate.advisor_id = data.alertSync.advisorId;
          profileUpdate.advisor_name = data.alertSync.advisorName;
        }

        if (Object.keys(profileUpdate).length > 0) {
          onStudentProfileUpdate(profileUpdate);
        }
      }

      if (data.alertSync?.synced && onAlertsSynced) {
        onAlertsSynced();
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
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
