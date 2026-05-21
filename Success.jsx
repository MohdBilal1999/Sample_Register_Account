import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Success() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('authUser');
    if (!raw) {
      navigate('/register', { replace: true });
      return;
    }
    setUser(JSON.parse(raw));
  }, [navigate]);

  function handleLogout() {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('authUser');
    navigate('/register');
  }

  if (!user) return null;

  return (
    <div className="card">
      <div className="success-icon">✓</div>
      <h1>Welcome, {user.name}!</h1>
      <p className="subtitle">Your account is ready.</p>

      <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, fontSize: '0.9rem' }}>
        <p style={{ margin: '0.25rem 0' }}>
          <strong>Email:</strong> {user.email}
        </p>
        <p style={{ margin: '0.25rem 0' }}>
          <strong>Mobile:</strong> {user.mobile}
        </p>
      </div>

      <button type="button" style={{ marginTop: '1.5rem' }} onClick={handleLogout}>
        Register another account
      </button>

      <div className="nav-links">
        <Link to="/database">View data in database</Link>
        {' · '}
        <Link to="/login">Log in as different user</Link>
      </div>
    </div>
  );
}
