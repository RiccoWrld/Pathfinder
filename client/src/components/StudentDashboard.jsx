import { useState } from 'react';
import NotificationArea from './NotificationArea';
import AIChat from './AIChat';
import './StudentDashboard.css';

const StudentDashboard = ({ user, onStudentProfileUpdate, onLogout }) => {
  const [alertsRefreshKey, setAlertsRefreshKey] = useState(0);
  const requirementsPercent = Number.isFinite(user?.completion_rate)
    ? user.completion_rate
    : null;
  const missingRequirementItems = Array.isArray(user?.missing_requirements)
    ? user.missing_requirements.slice(0, 4)
    : [];
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
          <div className="progress-heading">
            <div>
              <h3>DegreeWorks Requirements</h3>
              <p className="progress-note">
                {requirementsPercent === null
                  ? "Upload a DegreeWorks audit to calculate your requirements progress."
                  : "Requirements progress from your DegreeWorks audit."}
              </p>
            </div>
            {requirementsPercent !== null && (
              <strong>{requirementsPercent}%</strong>
            )}
          </div>

          <div className="progress-bar-container" aria-label="DegreeWorks requirements progress">
            <div
              className={`progress-fill ${requirementsPercent === null ? 'pending' : ''}`}
              style={{ width: `${requirementsPercent ?? 100}%` }}
            >
              {requirementsPercent === null ? "Pending audit" : `${requirementsPercent}% Requirements`}
            </div>
          </div>

          {missingRequirementItems.length > 0 && (
            <div className="missing-requirements">
              <h4>Missing Requirements</h4>
              {missingRequirementItems.map((requirement, index) => (
                <p key={`${requirement.course_code || 'requirement'}-${index}`}>
                  {requirement.course_code
                    ? `${requirement.course_code}: ${requirement.requirement}`
                    : requirement.requirement}
                </p>
              ))}
            </div>
          )}
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
