const bcrypt = require('bcryptjs');
const db = require('./db');

const DEFAULT_EXPIRY_MINUTES = 5;
const DEFAULT_MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_SECONDS = 60;

function normalizeMobile(mobile) {
  const digits = String(mobile).replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }
  return `+${digits}`;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getExpiryMinutes() {
  return Number(process.env.OTP_EXPIRY_MINUTES) || DEFAULT_EXPIRY_MINUTES;
}

function getMaxAttempts() {
  return Number(process.env.OTP_MAX_ATTEMPTS) || DEFAULT_MAX_ATTEMPTS;
}

function getResendCooldownSeconds() {
  return Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || RESEND_COOLDOWN_SECONDS;
}

async function createOtpSession(mobile) {
  const normalized = normalizeMobile(mobile);
  if (!normalized) {
    throw new Error('Invalid mobile number. Use 10–15 digits with optional country code.');
  }

  const rateKey = `otp:${normalized}`;
  if ((await db.countRateLimits(rateKey)) >= 3) {
    throw new Error('Too many OTP requests. Try again in 15 minutes.');
  }

  const existing = await db.getOtpSession(normalized);
  if (existing && existing.lastSentAt) {
    const elapsed = (Date.now() - existing.lastSentAt) / 1000;
    if (elapsed < getResendCooldownSeconds()) {
      const wait = Math.ceil(getResendCooldownSeconds() - elapsed);
      throw new Error(`Please wait ${wait} seconds before requesting a new OTP.`);
    }
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = Date.now() + getExpiryMinutes() * 60 * 1000;

  const session = {
    mobile: normalized,
    otpHash,
    expiresAt,
    attempts: 0,
    verified: false,
    lastSentAt: Date.now()
  };

  await db.upsertOtpSession(session);
  await db.recordRateLimit({ key: rateKey, timestamp: Date.now() });

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEMO OTP] Mobile ${normalized} => ${otp} (expires in ${getExpiryMinutes()} min)`);
  }

  return {
    mobile: normalized,
    expiresIn: getExpiryMinutes() * 60,
    demoOtp: process.env.NODE_ENV === 'development' ? otp : undefined
  };
}

async function verifyOtp(mobile, otp) {
  const normalized = normalizeMobile(mobile);
  if (!normalized) {
    throw new Error('Invalid mobile number.');
  }

  const session = await db.getOtpSession(normalized);
  if (!session) {
    throw new Error('No OTP found for this mobile. Request a new OTP.');
  }

  if (Date.now() > session.expiresAt) {
    await db.deleteOtpSession(normalized);
    throw new Error('OTP has expired. Request a new OTP.');
  }

  if (session.attempts >= getMaxAttempts()) {
    await db.deleteOtpSession(normalized);
    throw new Error('Too many failed attempts. Request a new OTP.');
  }

  const valid = await bcrypt.compare(String(otp), session.otpHash);
  if (!valid) {
    session.attempts += 1;
    await db.upsertOtpSession(session);
    const remaining = getMaxAttempts() - session.attempts;
    throw new Error(
      remaining > 0
        ? `Invalid OTP. ${remaining} attempt(s) remaining.`
        : 'Too many failed attempts. Request a new OTP.'
    );
  }

  session.verified = true;
  await db.upsertOtpSession(session);

  return { mobile: normalized, verified: true };
}

async function isMobileVerified(mobile) {
  const normalized = normalizeMobile(mobile);
  if (!normalized) return false;
  const session = await db.getOtpSession(normalized);
  return Boolean(session && session.verified && Date.now() <= session.expiresAt + 30 * 60 * 1000);
}

module.exports = {
  normalizeMobile,
  createOtpSession,
  verifyOtp,
  isMobileVerified,
  getResendCooldownSeconds
};
