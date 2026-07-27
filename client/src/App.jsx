import { useState } from "react";
import { Routes, Route, Navigate, useNavigate, Link } from "react-router-dom";
import AdvisorDashboard from "./components/AdvisorDashboard";
import StudentDashboard from "./components/StudentDashboard";
import Signup from "./components/SignUp";
import Login from "./components/Login";
import "./App.css";

const getStoredUser = () => {
  try {
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
  const navigate = useNavigate();

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    setIsLoggedIn(true);
    navigate(userData.role === "advisor" ? "/advisor" : "/student");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setIsLoggedIn(false);
    navigate("/login");
  };

  const updateStudentProfile = (profileData) => {
    setUser((prevUser) => {
      const nextUser = { ...prevUser, ...profileData };
      localStorage.setItem("user", JSON.stringify(nextUser));
      return nextUser;
    });
  };

  if (isLoggedIn) {
    return (
      <section id="center">
        <div className="hero"></div>
        <Routes>
          <Route
            path="/advisor"
            element={<AdvisorDashboard user={user} onLogout={handleLogout} />}
          />
          <Route
            path="/student"
            element={
              <StudentDashboard
                user={user}
                onStudentProfileUpdate={updateStudentProfile}
                onLogout={handleLogout}
              />
            }
          />
          <Route path="*" element={<Navigate to={user.role === "advisor" ? "/advisor" : "/student"} />} />
        </Routes>
      </section>
    );
  }

  return (
    <section id="center">
      <div className="hero"></div>
      <Routes>
        <Route path="/login" element={<AuthPage><Login onLoginSuccess={handleLogin} /></AuthPage>} />
        <Route path="/signup" element={<AuthPage><Signup onSignupSuccess={() => navigate("/login")} /></AuthPage>} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </section>
  );
}

function AuthPage({ children }) {
  const isLogin = window.location.pathname === "/login";
  return (
    <div className="auth-page">
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
      <section className="auth-panel" aria-label={isLogin ? "Login" : "Sign up"}>
        {children}
        <Link className="toggle-auth" to={isLogin ? "/signup" : "/login"}>
          {isLogin ? "Create a Pathfinder account" : "Back to login"}
        </Link>
      </section>
    </div>
  );
}

export default App;
