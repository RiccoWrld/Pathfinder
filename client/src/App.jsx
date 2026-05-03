import { useState } from "react";
import AdvisorDashboard from "./components/AdvisorDashboard";
import StudentDashboard from "./components/StudentDashboard";
import Signup from "./components/SignUp";
import Login from "./components/Login";
import "./App.css";

const getStoredUser = () => {
  try {
    // Keep users signed in after a page refresh.
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
};

function App() {
  const [user, setUser] = useState(getStoredUser);
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(user));
  const [view, setView] = useState("login");

  const handleLogin = (userData) => {
    // userData contains the ids and role the app needs to choose a dashboard.
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setIsLoggedIn(false);
    setView("login");
  };

  const updateStudentProfile = (profileData) => {
    setUser((prevUser) => {
      // Audit uploads can update GPA, progress, advisor, and university details.
      const nextUser = { ...prevUser, ...profileData };
      localStorage.setItem("user", JSON.stringify(nextUser));
      return nextUser;
    });
  };

  return (
    <section id="center">
      {/* Hero background remains consistent across all views */}
      <div className="hero"></div>

      {!isLoggedIn ? (
        <div className="auth-page">
          {/* Shared brand panel keeps login and signup feeling like one experience. */}
          <aside className="auth-brand-panel">
            <div className="auth-brand">
              <img src="/PathfinderLogo.png" alt="Pathfinder" />
              <span>Pathfinder</span>
            </div>
            <div className="auth-brand-copy">
              <p className="auth-kicker">Academic planning workspace</p>
              <h1>Keep every student, advisor, and requirement moving forward.</h1>
              <p>
                Upload DegreeWorks audits, surface urgent requirements, and give advising teams a clear view of what needs attention.
              </p>
            </div>
            <div className="auth-proof-grid" aria-label="Pathfinder highlights">
              <div>
                <strong>Audit-aware</strong>
                <span>Alerts from academic progress data</span>
              </div>
              <div>
                <strong>Advisor-ready</strong>
                <span>Prioritized cases and follow-up notes</span>
              </div>
              <div>
                <strong>Student-first</strong>
                <span>Clear actions after every review</span>
              </div>
            </div>
          </aside>

          <section className="auth-panel" aria-label={view === "login" ? "Login" : "Sign up"}>
            {view === "login" ? (
              <Login onLoginSuccess={handleLogin} />
            ) : (
              <Signup onSignupSuccess={() => setView("login")} />
            )}

            <button
              className="toggle-auth"
              onClick={() => setView(view === "login" ? "signup" : "login")}
            >
              {view === "login"
                ? "Create a Pathfinder account"
                : "Back to login"}
            </button>
          </section>
        </div>
      ) : user?.role === "advisor" ? (
        <>
          {/* Route advisors and students to different workspaces after login. */}
          <AdvisorDashboard user={user} onLogout={handleLogout} />
        </>
      ) : (
        <StudentDashboard
          user={user}
          onStudentProfileUpdate={updateStudentProfile}
          onLogout={handleLogout}
        />
      )}
    </section>
  );
}

export default App;
