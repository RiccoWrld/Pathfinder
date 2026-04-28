import React, { useState, useEffect, useRef } from 'react';
import './AIChat.css';

const AIChat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() && !file) return;

    // Display user message in UI
    const userDisplayMessage = input || `Uploaded: ${file.name}`;
    const userMessage = { role: 'user', content: userDisplayMessage };
    setMessages((prev) => [...prev, userMessage]);

    const currentInput = input;
    setInput(""); 
    setIsLoading(true);

    // Prepare Multipart Form Data for your index.js upload.single("file") route
    const formData = new FormData();
    formData.append("message", currentInput || "Please analyze the uploaded file.");
    if (file) formData.append("file", file);
    
    /** * Note: Your backend expects 'history' as an array or object to loop via .forEach.
     * We pass the current message history to maintain context.
     */
    messages.forEach((msg, index) => {
      formData.append(`history[${index}][role]`, msg.role);
      formData.append(`history[${index}][content]`, msg.content);
    });

    try {
      const response = await fetch("http://localhost:5000/api/ai/advisor", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.error || "Error processing request." }]);
      }
      
      setFile(null); // Reset file input after successful send
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: "Connection failed. Please ensure the server is running." }]);
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
        {isLoading && <div className="pathfinder-bubble assistant loading">Advisor is thinking...</div>}
        <div ref={messagesEndRef} />
      </div>

      <form className="pathfinder-input-form" onSubmit={handleSubmit}>
        <div className="pathfinder-controls">
          <label className="pathfinder-file-btn">
            <input 
              type="file" 
              accept=".pdf" 
              onChange={(e) => setFile(e.target.files[0])} 
              hidden 
            />
            {file ? "✅" : "📎"}
          </label>
          <input
            className="pathfinder-text-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={file ? `File: ${file.name}` : "Ask your advisor..."}
            disabled={isLoading}
          />
          <button className="pathfinder-send-btn" type="submit" disabled={isLoading}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;