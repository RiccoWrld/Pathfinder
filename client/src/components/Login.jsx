import React, { useState } from 'react';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Store the token and user info for the session
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLoginSuccess(data.user);
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Server error. Please try again.");
    }
  };

  return (
    <div className="auth-container">
      <h2>Login to Pathfinder</h2>
      <form onSubmit={handleSubmit}>
        <input 
          type="email" 
          placeholder="University Email" 
          required 
          onChange={(e) => setFormData({...formData, email: e.target.value})}
        />
        <input 
          type="password" 
          placeholder="Password" 
          required 
          onChange={(e) => setFormData({...formData, password: e.target.value})}
        />
        <button type="submit">Login</button>
      </form>
      {error && <p className="auth-message" style={{color: 'red'}}>{error}</p>}
    </div>
  );
};

export default Login;