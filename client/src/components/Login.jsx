import { useState } from 'react';
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
    } catch {
      setError("Server error. Please try again.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-heading">
        <p>Welcome back</p>
        <h2>Log in to Pathfinder</h2>
        <span>Use your university credentials to continue to your advising workspace.</span>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <label htmlFor="login-email">University Email</label>
        <input
          id="login-email"
          type="email" 
          placeholder="name@university.edu"
          required 
          onChange={(e) => setFormData({...formData, email: e.target.value})}
        />

        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password" 
          placeholder="Enter your password"
          required 
          onChange={(e) => setFormData({...formData, password: e.target.value})}
        />

        <button type="submit">Log in</button>
      </form>
      {error && <p className="auth-message error">{error}</p>}
    </div>
  );
};

export default Login;
