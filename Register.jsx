import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendOtp } from '../api';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    mobile: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function updateField(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    const digits = form.mobile.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Enter a valid mobile number (at least 10 digits).');
      return;
    }

    setLoading(true);
    try {
      const result = await sendOtp(form.mobile, form.email);
      sessionStorage.setItem(
        'pendingRegistration',
        JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          mobile: result.mobile || form.mobile
        })
      );
      sessionStorage.setItem('demoOtp', result.demoOtp || '');
      navigate('/verify-otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h1>Create account</h1>
      <p className="subtitle">Register with your mobile number. We will send a one-time password.</p>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label>
          Full name
          <input name="name" value={form.name} onChange={updateField} required />
        </label>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={updateField} required />
        </label>
        <label>
          Mobile number
          <input
            name="mobile"
            type="tel"
            placeholder="+1 555 123 4567"
            value={form.mobile}
            onChange={updateField}
            required
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={updateField}
            required
            minLength={6}
          />
        </label>
        <label>
          Confirm password
          <input
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={updateField}
            required
            minLength={6}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Sending OTP...' : 'Send OTP'}
        </button>
      </form>

      <div className="nav-links">
        Already have an account? <Link to="/login">Log in</Link>
        {' · '}
        <Link to="/database">View database</Link>
      </div>
    </div>
  );
}
