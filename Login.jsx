import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      sessionStorage.setItem('authToken', result.token);
      sessionStorage.setItem('authUser', JSON.stringify(result.user));
      navigate('/success');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h1>Log in</h1>
      <p className="subtitle">Sign in with your email and password.</p>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Log in'}
        </button>
      </form>

      <div className="nav-links">
        New user? <Link to="/register">Create account</Link>
      </div>
    </div>
  );
}
