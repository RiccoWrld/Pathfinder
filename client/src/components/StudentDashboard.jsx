import React from 'react';
import NotificationArea from './NotificationArea';
import AIChat from './AIChat';
import './StudentDashboard.css';

const StudentDashboard = ({ user }) => {
  // FIXED: Defined completionRate so the progress bar works.
  // This uses a fallback of 75% if no specific data is found in the user object.
  const completionRate = user?.completion_rate || 75; 

  return (
    <div className="dashboard-grid">
      <div className="left-panel">
        <header className="welcome-banner">
          <h1>Welcome back, Student</h1>
          {/* Displays the university ID or Name associated with the account */}
          <p>University Portal: {user?.university_name || `Institution #${user?.university_id}`}</p>
        </header>
        
        {/* Real-time notification component pulling from your Render DB */}
        <NotificationArea studentId={user?.id} />
        
        <div className="degree-progress">
          <h3>Degree Completion</h3>
          <div className="progress-bar-container">
            {/* The width now updates dynamically based on the completionRate variable */}
            <div 
              className="progress-fill" 
              style={{ width: `${completionRate}%` }}
            >
              {completionRate}%
            </div>
          </div>
        </div>
      </div>

      <div className="right-panel">
        {/* The 24/7 AI Advisor integrated via the backend route */}
        <AIChat user={user} />
      </div>
    </div>
  );
};

export default StudentDashboard;