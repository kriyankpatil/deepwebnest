import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
function verifyToken(req){
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    try {
      const category = req.query.category || null;
      const { rows } = await pool.query(
        'select id, category, label, url, owner, created_at from public.custom_links where ($1::text is null or category=$1) order by created_at asc',
        [category]
      );
      return res.status(200).json({ ok: true, items: rows });
    } catch (e) {
      // If table doesn't exist, return empty array
      if (e.message.includes('relation "custom_links" does not exist')) {
        return res.status(200).json({ ok: true, items: [] });
      }
      return res.status(500).json({ error: e.message || 'server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const user = verifyToken(req);
      if (!user) return res.status(401).json({ error: 'missing token' });
      const { category, label, url } = req.body || {};
      const owner = user.email || null;
      if (!category || !label || !url || !owner) return res.status(400).json({ error: 'missing fields' });
      const { rows } = await pool.query(
        'insert into public.custom_links (category, label, url, owner) values ($1,$2,$3,$4) returning id, category, label, url, owner, created_at',
        [category, label, url, owner]
      );
      return res.status(200).json({ ok: true, link: rows[0] });
    } catch (e) {
      // If table doesn't exist, create it and retry
      if (e.message.includes('relation "custom_links" does not exist')) {
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS public.custom_links (
              id SERIAL PRIMARY KEY,
              category VARCHAR(100) NOT NULL,
              label VARCHAR(255) NOT NULL,
              url TEXT NOT NULL,
              owner VARCHAR(255) NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
          `);
          // Retry the operation
          const user = verifyToken(req);
          const { category, label, url } = req.body || {};
          const owner = user.email || null;
          const { rows } = await pool.query(
            'insert into public.custom_links (category, label, url, owner) values ($1,$2,$3,$4) returning id, category, label, url, owner, created_at',
            [category, label, url, owner]
          );
          return res.status(200).json({ ok: true, link: rows[0] });
        } catch (createError) {
          return res.status(500).json({ error: 'Failed to create table: ' + createError.message });
        }
      }
      return res.status(500).json({ error: e.message || 'server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const user = verifyToken(req);
      if (!user) return res.status(401).json({ error: 'missing token' });
      const id = req.query.id || req.body && req.body.id;
      if (!id) return res.status(400).json({ error: 'missing id' });
      const row = await pool.query('select owner from public.custom_links where id=$1', [id]);
      if (row.rows.length === 0) return res.status(404).json({ error: 'not found' });
      if (row.rows[0].owner !== (user.email || null)) return res.status(403).json({ error: 'forbidden' });
      await pool.query('delete from public.custom_links where id=$1', [id]);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message || 'server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const user = verifyToken(req);
      if (!user) return res.status(401).json({ error: 'missing token' });
      const { id, label, url, category } = req.body || {};
      if (!id) return res.status(400).json({ error: 'missing id' });
      if (!label && !url && !category) return res.status(400).json({ error: 'nothing to update' });
      const row = await pool.query('select owner from public.custom_links where id=$1', [id]);
      if (row.rows.length === 0) return res.status(404).json({ error: 'not found' });
      if (row.rows[0].owner !== (user.email || null)) return res.status(403).json({ error: 'forbidden' });
      const fields = [];
      const values = [];
      let idx = 1;
      if (label) { fields.push(`label=$${idx++}`); values.push(label); }
      if (url) { fields.push(`url=$${idx++}`); values.push(url); }
      if (category) { fields.push(`category=$${idx++}`); values.push(category); }
      values.push(id);
      const sql = `update public.custom_links set ${fields.join(', ')} where id=$${idx} returning id, category, label, url, owner, created_at`;
      const upd = await pool.query(sql, values);
      return res.status(200).json({ ok: true, link: upd.rows[0] });
    } catch (e) {
      return res.status(500).json({ error: e.message || 'server error' });
    }
  }

  res.setHeader('Allow', ['GET','POST','PUT','DELETE']);
  return res.status(405).json({ error: 'Method Not Allowed' });
}


