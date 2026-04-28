import { useState } from 'react';
import NotificationArea from './components/NotificationArea';
import Signup from './components/SignUp';
import Login from './components/Login'; 
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState('login');
  const [user, setUser] = useState(null);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
  };

  return (
    <section id="center">
      <div className="hero"></div>

      {!isLoggedIn ? (
        <>
          {view === 'login' ? (
            <Login onLoginSuccess={handleLogin} />
          ) : (
            <Signup onSignupSuccess={() => setView('login')} />
          )}
          
          <button className="toggle-auth" onClick={() => setView(view === 'login' ? 'signup' : 'login')}>
            {view === 'login' ? "Need an account? Sign Up" : "Already have an account? Login"}
          </button>
        </>
      ) : (
        <NotificationArea studentId={user.id} />
      )}
    </section>
  );
}

export default App;