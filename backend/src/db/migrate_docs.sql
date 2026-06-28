CREATE TABLE IF NOT EXISTS documents (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  filename      TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type     TEXT,
  size          INTEGER,
  uploaded_by   INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
