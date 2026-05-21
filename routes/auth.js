const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const otp = require('../otp');

const router = express.Router();

const sendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests from this IP. Try again later.' }
});

function signToken(user) {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  return jwt.sign(
    { sub: user.id, email: user.email, mobile: user.mobile },
    secret,
    { expiresIn: '7d' }
  );
}

router.post('/send-otp', sendOtpLimiter, async (req, res) => {
  try {
    const { mobile, email } = req.body;
    if (!mobile) {
      return res.status(400).json({ error: 'Mobile number is required.' });
    }

    if (email) {
      const existing = await db.findUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'Email is already registered.' });
      }
    }

    const normalized = otp.normalizeMobile(mobile);
    if (!normalized) {
      return res.status(400).json({ error: 'Invalid mobile number.' });
    }

    const existingMobile = await db.findUserByMobile(normalized);
    if (existingMobile) {
      return res.status(409).json({ error: 'Mobile number is already registered.' });
    }

    const result = await otp.createOtpSession(mobile);
    return res.json({
      message: 'OTP sent successfully (demo mode).',
      mobile: result.mobile,
      expiresIn: result.expiresIn,
      demoOtp: result.demoOtp
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { mobile, otp: code } = req.body;
    if (!mobile || !code) {
      return res.status(400).json({ error: 'Mobile and OTP are required.' });
    }

    const result = await otp.verifyOtp(mobile, code);
    return res.json({
      message: 'Mobile verified successfully.',
      mobile: result.mobile,
      verified: true
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, mobile } = req.body;

    if (!name || !email || !password || !mobile) {
      return res.status(400).json({ error: 'Name, email, password, and mobile are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const normalizedMobile = otp.normalizeMobile(mobile);
    if (!normalizedMobile) {
      return res.status(400).json({ error: 'Invalid mobile number.' });
    }

    if (!(await otp.isMobileVerified(normalizedMobile))) {
      return res.status(403).json({ error: 'Mobile not verified. Complete OTP verification first.' });
    }

    if (await db.findUserByEmail(email)) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    if (await db.findUserByMobile(normalizedMobile)) {
      return res.status(409).json({ error: 'Mobile number is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      mobile: normalizedMobile,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    await db.createUser(user);
    await db.deleteOtpSession(normalizedMobile);

    const token = signToken(user);
    return res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user);
    return res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
