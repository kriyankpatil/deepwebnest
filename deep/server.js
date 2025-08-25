import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors({
  origin: [
    'http://localhost:8000',
    'http://127.0.0.1:8000'
  ],
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env');
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true
});

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
function signToken(payload){
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function authMiddleware(req, res, next){
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { email }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// Basic request logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.get('/health', async (_req, res) => {
  try {
    await pool.query('select 1');
    return res.json({ ok: true });
  } catch (e) {
    console.error('DB health check failed:', e.message);
    return res.status(500).json({ ok: false, error: 'db_failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password, displayName } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const passHash = sha256(password);

    const { rows } = await pool.query(
      'select id, email, password_hash from public.app_users where email=$1 limit 1',
      [email]
    );
    if (rows.length === 0) {
      const ins = await pool.query(
        'insert into public.app_users (email, password_hash, display_name) values ($1,$2,$3) returning id, email',
        [email, passHash, displayName || null]
      );
      const token = signToken({ email: ins.rows[0].email });
      return res.json({ ok: true, user: ins.rows[0], token, created: true });
    }
    if (rows[0].password_hash !== passHash) return res.status(401).json({ error: 'invalid credentials' });
    const token = signToken({ email });
    return res.json({ ok: true, user: { id: rows[0].id, email }, token });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'server error' });
  }
});

app.post('/api/links', authMiddleware, async (req, res) => {
  try {
    const { category, label, url } = req.body || {};
    const owner = (req.user && req.user.email) || null;
    if (!category || !label || !url || !owner) return res.status(400).json({ error: 'missing fields' });

    const { rows } = await pool.query(
      'insert into public.custom_links (category, label, url, owner) values ($1,$2,$3,$4) returning id, category, label, url, owner, created_at',
      [category, label, url, owner]
    );
    return res.json({ ok: true, link: rows[0] });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'server error' });
  }
});

app.get('/api/links', async (req, res) => {
  try {
    const { category } = req.query;
    const { rows } = await pool.query(
      'select id, category, label, url, owner, created_at from public.custom_links where ($1::text is null or category=$1) order by created_at asc',
      [category || null]
    );
    return res.json({ ok: true, items: rows });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'server error' });
  }
});

app.put('/api/links/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { label, url, category } = req.body || {};
    if (!label && !url && !category) return res.status(400).json({ error: 'nothing to update' });
    const email = (req.user && req.user.email) || null;
    const row = await pool.query('select owner from public.custom_links where id=$1', [id]);
    if (row.rows.length === 0) return res.status(404).json({ error: 'not found' });
    if (row.rows[0].owner !== email) return res.status(403).json({ error: 'forbidden' });
    const fields = [];
    const values = [];
    let idx = 1;
    if (label) { fields.push(`label=$${idx++}`); values.push(label); }
    if (url) { fields.push(`url=$${idx++}`); values.push(url); }
    if (category) { fields.push(`category=$${idx++}`); values.push(category); }
    values.push(id);
    const sql = `update public.custom_links set ${fields.join(', ')} where id=$${idx} returning id, category, label, url, owner, created_at`;
    const upd = await pool.query(sql, values);
    return res.json({ ok: true, link: upd.rows[0] });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'server error' });
  }
});

app.delete('/api/links/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    // Simple owner check: only allow delete if owner matches
    const email = (req.user && req.user.email) || null;
    const row = await pool.query('select owner from public.custom_links where id=$1', [id]);
    if (row.rows.length === 0) return res.status(404).json({ error: 'not found' });
    if (row.rows[0].owner !== email) return res.status(403).json({ error: 'forbidden' });
    await pool.query('delete from public.custom_links where id=$1', [id]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'server error' });
  }
});

const port = process.env.PORT || 8080;

// Test DB connection on startup
pool.connect().then(client => {
  client.release();
  console.log('DB connection OK');
}).catch(err => {
  console.error('DB connection error:', err.message);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

app.listen(port, () => {
  console.log(`API listening on :${port}`);
});
