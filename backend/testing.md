Backend setup

1. Copy `.env.example` to `.env` inside `backend/`.
2. Set `SUPABASE_DB_URL` to your Supabase Postgres connection string.
3. Install requirements with `pip install -r requirements.txt`.
4. Start the API with `uvicorn app.main:app --reload`.

Notes

- If `SUPABASE_DB_URL` is missing, the app falls back to a local SQLite database in `backend/app/data/local-dev.db`.
- The API auto-creates tables on startup and seeds starter data the first time it runs.
- Manager test login: `manager@company.com` / `manager123`
- Employee test login: `employee@company.com` / `employee123` with `EMP-1001`
