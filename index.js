require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const db = require('./db');

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  const info = db.getStorageInfo();
  res.json({
    status: 'ok',
    mode: process.env.NODE_ENV || 'development',
    storage: info.mode,
    databaseName: info.database,
    connection: info.mongodbUri,
    jsonPath: info.jsonPath,
    hint:
      info.mode === 'json-file'
        ? 'Data is in app.json until MongoDB connects. Use mongodb+srv from Atlas Connect.'
        : 'Data is stored in MongoDB.'
  });
});

app.use('/api/auth', authRoutes);

app.get('/api/users', async (_req, res) => {
  try {
    const users = await db.listUsers();
    res.json({
      count: users.length,
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        createdAt: u.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

async function start() {
  await db.init();
  app.listen(PORT, () => {
    console.log(`OTP registration API running at http://localhost:${PORT}`);
    console.log(`CORS allowed origin: ${CLIENT_ORIGIN}`);
  });
}

start();
