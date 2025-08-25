# Deep Web Nest (Static Clone)

Static clone of the Deep Web Nest homepage layout and sections.

- Source: https://deepwebnest.com/

## Run locally

- Open `index.html` directly, or serve the folder:

```powershell
cd "C:\Users\kriya\Desktop\deep"
python -m http.server 8000
```

Open `http://localhost:8000/index.html`.

## Customize
- Edit content in `index.html`.
- Adjust styles in `styles.css`.

## Notes
- Unofficial clone for demo/education.

## API server

Create `.env` beside `server.js`:

PORT=8080
DATABASE_URL=postgresql://postgres.sqtumdmqnfspqzfcijce:%5Bkriyank%40123%5D@aws-1-us-east-2.pooler.supabase.com:6543/postgres

Install and run:

```bash
npm i
npm run dev
```

Endpoints:
- POST /api/login { email, password }
- POST /api/links { category, label, url, owner }
- GET  /api/links?category=games
- DELETE /api/links/:id
