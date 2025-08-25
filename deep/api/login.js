import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
function signToken(payload){
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  try {
    const { email, password, displayName } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const passHash = sha256(password);
    const { rows } = await pool.query('select id, email, password_hash from public.app_users where email=$1 limit 1', [email]);
    if (rows.length === 0) {
      const ins = await pool.query(
        'insert into public.app_users (email, password_hash, display_name) values ($1,$2,$3) returning id, email',
        [email, passHash, displayName || null]
      );
      const token = signToken({ email: ins.rows[0].email });
      return res.status(200).json({ ok: true, user: ins.rows[0], token, created: true });
    }
    if (rows[0].password_hash !== passHash) return res.status(401).json({ error: 'invalid credentials' });
    const token = signToken({ email });
    return res.status(200).json({ ok: true, user: { id: rows[0].id, email }, token });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'server error' });
  }
}


