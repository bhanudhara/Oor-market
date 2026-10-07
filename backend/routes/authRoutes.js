import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { authenticate, jwtSecret } from '../auth/authMiddleware.js';

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
});

router.post('/login', loginLimiter, async (request, response) => {
  const email = String(request.body?.email ?? '').trim().toLowerCase();
  const password = String(request.body?.password ?? '');
  if (!email || !password) return response.status(400).json({ error: 'Enter your email and password.' });

  const result = await pool.query(`
    SELECT id, email, password_hash, role, display_name, profile_id, latitude, longitude
    FROM users WHERE email = $1
  `, [email]);
  const account = result.rows[0];
  if (!account || !(await bcrypt.compare(password, account.password_hash))) {
    return response.status(401).json({ error: 'Email or password is incorrect.' });
  }

  const user = {
    id: account.id,
    email: account.email,
    role: account.role,
    displayName: account.display_name,
    profileId: account.profile_id,
    latitude: account.latitude,
    longitude: account.longitude,
  };
  const token = jwt.sign(user, jwtSecret(), { subject: user.id, expiresIn: '8h' });
  response.json({ token, user });
});

router.get('/me', authenticate, async (request, response) => {
  const result = await pool.query(`
    SELECT id, email, role, display_name AS "displayName", profile_id AS "profileId", latitude, longitude
    FROM users WHERE id = $1
  `, [request.user.id]);
  if (!result.rowCount) return response.status(401).json({ error: 'This account is no longer active.' });
  response.json({ user: result.rows[0] });
});

router.patch('/location', authenticate, async (request, response) => {
  const { latitude, longitude } = request.body ?? {};
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return response.status(400).json({ error: 'Enter valid latitude and longitude coordinates.' });
  }
  await pool.query('UPDATE users SET latitude = $1, longitude = $2 WHERE id = $3', [latitude, longitude, request.user.id]);
  response.json({ user: { ...request.user, latitude, longitude } });
});

export default router;