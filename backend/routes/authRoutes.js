import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { authenticate, jwtSecret } from '../auth/authMiddleware.js';

const router = Router();

router.post('/login', async (request, response) => {
  const email = String(request.body?.email ?? '').trim().toLowerCase();
  const password = String(request.body?.password ?? '');
  if (!email || !password) return response.status(400).json({ error: 'Enter your email and password.' });

  const result = await pool.query(`
    SELECT id, email, password_hash, role, display_name, profile_id
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
  };
  const token = jwt.sign(user, jwtSecret(), { subject: user.id, expiresIn: '8h' });
  response.json({ token, user });
});

router.get('/me', authenticate, (request, response) => {
  const { id, email, role, displayName, profileId } = request.user;
  response.json({ user: { id, email, role, displayName, profileId } });
});

export default router;