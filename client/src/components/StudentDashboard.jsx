import { useState } from 'react';
import NotificationArea from './NotificationArea';
import AIChat from './AIChat';
import './StudentDashboard.css';

const StudentDashboard = ({ user, onStudentProfileUpdate, onLogout }) => {
  const [alertsRefreshKey, setAlertsRefreshKey] = useState(0);
  const completionRate = Number.isFinite(user?.completion_rate)
    ? user.completion_rate
    : null;
  const universityLabel = user?.university_name || user?.university_domain || "Upload DegreeWorks to detect school";
  const studentId = user?.student_id || user?.id;

  return (
    <div className="dashboard-grid">
      <button className="dashboard-logout" onClick={onLogout}>Logout</button>
      <div className="left-panel">
        <header className="welcome-banner">
          <div>
            <h1>Welcome back, {user?.student_name || "Student"}</h1>
            {/* Displays the university ID or Name associated with the account */}
            <p>University Portal: {universityLabel}</p>
          </div>
        </header>
        
        {/* Real-time notification component pulling from your Render DB */}
        <NotificationArea studentId={studentId} refreshKey={alertsRefreshKey} />
        
        <div className="degree-progress">
          <h3>Degree Completion</h3>
          {completionRate === null && (
            <p className="progress-note">Upload a DegreeWorks audit to calculate your progress.</p>
          )}
          <div className="progress-bar-container">
            {/* The width now updates dynamically based on the completionRate variable */}
            <div 
              className={`progress-fill ${completionRate === null ? 'pending' : ''}`}
              style={{ width: `${completionRate ?? 100}%` }}
            >
              {completionRate === null ? "Pending audit" : `${completionRate}%`}
            </div>
          </div>
        </div>
      </div>

      <div className="right-panel">
        {/* The 24/7 AI Advisor integrated via the backend route */}
        <AIChat
          user={user}
          onStudentProfileUpdate={onStudentProfileUpdate}
          onAlertsSynced={() => setAlertsRefreshKey(key => key + 1)}
        />
      </div>
    </div>
  );
};

export default StudentDashboard;
