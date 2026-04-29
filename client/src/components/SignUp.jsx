import { useState, useEffect } from 'react';
import './SignUp.css';

const Signup = ({ onSignupSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'student',
    university_id: ''
  });
  const [universities, setUniversities] = useState([]);
  const [message, setMessage] = useState('');

  // Fetch the list of schools from your new backend route
  useEffect(() => {
    fetch('http://localhost:5000/api/universities')
      .then(res => res.json())
      .then(data => setUniversities(data))
      .catch(err => console.error("Error loading universities:", err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage("Signup successful! You can now login.");
        onSignupSuccess?.();
      } else {
        setMessage(data.error || "Signup failed");
      }
    } catch {
      setMessage("Server error. Please try again.");
    }
  };

  return (
    <div className="auth-container">
      <h2>Create your Pathfinder Account</h2>
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
        
        <label>I am a:</label>
        <select onChange={(e) => setFormData({...formData, role: e.target.value})}>
          <option value="student">Student</option>
          <option value="advisor">Advisor</option>
        </select>

        <label>Select University:</label>
        <select required onChange={(e) => setFormData({...formData, university_id: e.target.value})}>
          <option value="">-- Choose School --</option>
          {universities.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <button type="submit">Sign Up</button>
      </form>
      {message && <p className="auth-message">{message}</p>}
    </div>
  );
};

export default Signup;
