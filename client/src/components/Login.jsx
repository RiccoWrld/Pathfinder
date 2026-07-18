import { useState } from 'react';
import { api } from '../api';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await api.post('/auth/login', formData);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || "Login failed");
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
