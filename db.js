const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('./models/User');
const OtpSession = require('./models/OtpSession');
const RateLimit = require('./models/RateLimit');

let storageMode = 'unknown'; // 'mongodb' | 'json-file'
let jsonCache = null;

const defaultJson = { users: [], otpSessions: [], rateLimits: [] };

function getMongoUri() {
  return process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/otp_registration';
}

function getJsonPath() {
  const configured = process.env.DATABASE_PATH;
  if (configured && configured.endsWith('.json')) {
    return path.isAbsolute(configured)
      ? configured
      : path.join(__dirname, configured.replace(/^\.\//, ''));
  }
  return path.join(__dirname, 'data', 'app.json');
}

function getStorageInfo() {
  return {
    mode: storageMode,
    mongodbUri: getMongoUri().replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'),
    jsonPath: storageMode === 'json-file' ? getJsonPath() : null,
    database: storageMode === 'mongodb' ? mongoose.connection?.name : null
  };
}

// --- JSON file storage (fallback) ---

function ensureJson() {
  const jsonPath = getJsonPath();
  const dir = path.dirname(jsonPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(jsonPath)) {
    fs.writeFileSync(jsonPath, JSON.stringify(defaultJson, null, 2), 'utf8');
  }
}

function readJson() {
  ensureJson();
  if (!jsonCache) {
    jsonCache = { ...defaultJson, ...JSON.parse(fs.readFileSync(getJsonPath(), 'utf8')) };
  }
  return jsonCache;
}

function writeJson(data) {
  jsonCache = data;
  ensureJson();
  fs.writeFileSync(getJsonPath(), JSON.stringify(data, null, 2), 'utf8');
}

function docToUser(doc) {
  if (!doc) return null;
  if (storageMode === 'json-file') {
    return {
      id: doc.id,
      name: doc.name,
      email: doc.email,
      mobile: doc.mobile,
      passwordHash: doc.passwordHash,
      createdAt: doc.createdAt
    };
  }
  return {
    id: doc.userId,
    name: doc.name,
    email: doc.email,
    mobile: doc.mobile,
    passwordHash: doc.passwordHash,
    createdAt: doc.createdAt?.toISOString?.() || doc.createdAt
  };
}

function docToOtpSession(doc) {
  if (!doc) return null;
  return {
    mobile: doc.mobile,
    otpHash: doc.otpHash || doc.otp_hash,
    expiresAt: doc.expiresAt ?? doc.expires_at,
    attempts: doc.attempts,
    verified: Boolean(doc.verified),
    lastSentAt: doc.lastSentAt ?? doc.last_sent_at
  };
}

// --- MongoDB ---

async function tryConnectMongo() {
  const uri = getMongoUri();
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  storageMode = 'mongodb';
  console.log(`MongoDB connected: ${mongoose.connection.host} / "${mongoose.connection.name}"`);
  await migrateJsonToMongo();
}

async function migrateJsonToMongo() {
  const jsonPath = getJsonPath();
  if (!fs.existsSync(jsonPath)) return;

  let legacy;
  try {
    legacy = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    return;
  }

  let migrated = 0;
  for (const u of legacy.users || []) {
    const exists = await User.findOne({ userId: u.id }).lean();
    if (exists) continue;
    try {
      await User.create({
        userId: u.id,
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        passwordHash: u.passwordHash,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date()
      });
      migrated += 1;
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  if (migrated > 0) console.log(`Migrated ${migrated} user(s) from app.json into MongoDB.`);
}

async function init() {
  try {
    await tryConnectMongo();
    return;
  } catch (err) {
    console.warn('');
    console.warn('*** MongoDB NOT reachable ***');
    console.warn(err.message);
    console.warn('Using local file: ' + getJsonPath());
    console.warn('Fix: Use mongodb+srv://... from Atlas Connect (not IP only).');
    console.warn('     Atlas → Network Access → add your IP.');
    console.warn('');
  }

  storageMode = 'json-file';
  readJson();
  console.log(`Storage mode: JSON file (${getJsonPath()})`);
}

// --- CRUD ---

async function findUserByEmail(email) {
  if (storageMode === 'mongodb') {
    return docToUser(await User.findOne({ email: email.toLowerCase().trim() }).lean());
  }
  const db = readJson();
  return docToUser(db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null);
}

async function findUserByMobile(mobile) {
  if (storageMode === 'mongodb') {
    return docToUser(await User.findOne({ mobile }).lean());
  }
  const db = readJson();
  return docToUser(db.users.find((u) => u.mobile === mobile) || null);
}

async function findUserById(id) {
  if (storageMode === 'mongodb') {
    return docToUser(await User.findOne({ userId: id }).lean());
  }
  const db = readJson();
  return docToUser(db.users.find((u) => u.id === id) || null);
}

async function listUsers() {
  if (storageMode === 'mongodb') {
    const docs = await User.find().sort({ createdAt: -1 }).lean();
    return docs.map(docToUser);
  }
  const db = readJson();
  return [...db.users]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .map(docToUser);
}

async function createUser(user) {
  if (storageMode === 'mongodb') {
    await User.create({
      userId: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt ? new Date(user.createdAt) : new Date()
    });
    console.log(`[MongoDB] User saved: ${user.email}`);
    return user;
  }

  const db = readJson();
  db.users.push(user);
  writeJson(db);
  console.log(`[JSON file] User saved: ${user.email} → ${getJsonPath()}`);
  return user;
}

async function upsertOtpSession(session) {
  if (storageMode === 'mongodb') {
    await OtpSession.findOneAndUpdate(
      { mobile: session.mobile },
      {
        mobile: session.mobile,
        otpHash: session.otpHash,
        expiresAt: session.expiresAt,
        attempts: session.attempts ?? 0,
        verified: Boolean(session.verified),
        lastSentAt: session.lastSentAt
      },
      { upsert: true, new: true }
    );
    return session;
  }

  const db = readJson();
  const idx = db.otpSessions.findIndex((s) => s.mobile === session.mobile);
  if (idx >= 0) db.otpSessions[idx] = session;
  else db.otpSessions.push(session);
  writeJson(db);
  return session;
}

async function getOtpSession(mobile) {
  if (storageMode === 'mongodb') {
    return docToOtpSession(await OtpSession.findOne({ mobile }).lean());
  }
  const db = readJson();
  return docToOtpSession(db.otpSessions.find((s) => s.mobile === mobile) || null);
}

async function deleteOtpSession(mobile) {
  if (storageMode === 'mongodb') {
    await OtpSession.deleteOne({ mobile });
    return;
  }
  const db = readJson();
  db.otpSessions = db.otpSessions.filter((s) => s.mobile !== mobile);
  writeJson(db);
}

async function recordRateLimit(entry) {
  if (storageMode === 'mongodb') {
    await RateLimit.create({ key: entry.key });
    return;
  }
  const db = readJson();
  db.rateLimits.push({ key: entry.key, timestamp: entry.timestamp });
  const cutoff = Date.now() - 15 * 60 * 1000;
  db.rateLimits = db.rateLimits.filter((r) => r.timestamp > cutoff);
  writeJson(db);
}

async function countRateLimits(key, windowMs = 15 * 60 * 1000) {
  if (storageMode === 'mongodb') {
    const cutoff = new Date(Date.now() - windowMs);
    return RateLimit.countDocuments({ key, createdAt: { $gt: cutoff } });
  }
  const db = readJson();
  const cutoff = Date.now() - windowMs;
  return db.rateLimits.filter((r) => r.key === key && r.timestamp > cutoff).length;
}

module.exports = {
  init,
  getStorageInfo,
  findUserByEmail,
  findUserByMobile,
  findUserById,
  listUsers,
  createUser,
  upsertOtpSession,
  getOtpSession,
  deleteOtpSession,
  recordRateLimit,
  countRateLimits
};
