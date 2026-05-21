import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchHealth, fetchUsers } from '../api';

export default function ViewDatabase() {
  const [health, setHealth] = useState(null);
  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [healthData, usersData] = await Promise.all([fetchHealth(), fetchUsers()]);
      setHealth(healthData);
      setUsers(usersData.users || []);
      setCount(usersData.count ?? 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="card card-wide">
      <h1>Database — registered users</h1>
      <p className="subtitle">
        Live data from your storage. Register someone new, then click Refresh.
      </p>

      {health && (
        <div className={`db-info ${health.storage === 'json-file' ? 'db-warn' : ''}`}>
          <span>
            <strong>Storage:</strong> {health.storage === 'mongodb' ? 'MongoDB' : 'Local JSON file'}
          </span>
          <span>
            <strong>Status:</strong> {health.status}
          </span>
          {health.hint && <p className="storage-hint">{health.hint}</p>}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <div className="toolbar">
        <button type="button" onClick={loadData} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <span className="user-count">{count} user(s) in database</span>
      </div>

      {loading && !error && <p className="cooldown">Loading from MongoDB...</p>}

      {!loading && !error && users.length === 0 && (
        <p className="empty-state">No users yet. <Link to="/register">Register the first account</Link>.</p>
      )}

      {!loading && users.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Registered</th>
                <th>User ID</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.mobile}</td>
                  <td>{u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}</td>
                  <td className="mono">{u.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="nav-links">
        <Link to="/register">Register new user</Link>
        {' · '}
        <Link to="/login">Log in</Link>
      </div>

      <p className="atlas-hint">
        You can also view the same data in <strong>MongoDB Atlas</strong> → your cluster →{' '}
        <strong>Browse Collections</strong> → database <code>otp_registration</code> → collection{' '}
        <code>users</code>.
      </p>
    </div>
  );
}
