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
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
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
    // If table doesn't exist, create it and retry
    if (e.message.includes('relation "app_users" does not exist')) {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS public.app_users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            display_name VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);
        // Retry the operation
        const { email, password, displayName } = req.body || {};
        const passHash = sha256(password);
        const ins = await pool.query(
          'insert into public.app_users (email, password_hash, display_name) values ($1,$2,$3) returning id, email',
          [email, passHash, displayName || null]
        );
        const token = signToken({ email: ins.rows[0].email });
        return res.status(200).json({ ok: true, user: ins.rows[0], token, created: true });
      } catch (createError) {
        return res.status(500).json({ error: 'Failed to create table: ' + createError.message });
      }
    }
    return res.status(500).json({ error: e.message || 'server error' });
  }
}


