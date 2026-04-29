import { useState } from "react";
import AdvisorDashboard from "./components/AdvisorDashboard";
import StudentDashboard from "./components/StudentDashboard";
import Signup from "./components/SignUp";
import Login from "./components/Login";
import "./App.css";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState("login");
  const [user, setUser] = useState(null);

  const handleLogin = (userData) => {
    // userData contains the id, role, and university_id from your database
    setUser(userData);
    setIsLoggedIn(true);
  };

  const updateStudentProfile = (profileData) => {
    setUser((prevUser) => {
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
        <div className="auth-wrapper">
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
              ? "Need an account? Sign Up"
              : "Already have an account? Login"}
          </button>
        </div>
      ) : user?.role === "advisor" ? (
        <AdvisorDashboard user={user} />
      ) : (
        <StudentDashboard
          user={user}
          onStudentProfileUpdate={updateStudentProfile}
        />
      )}
    </section>
  );
}

export default App;
