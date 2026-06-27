CREATE TABLE IF NOT EXISTS news_posts (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  body         TEXT,
  image_path   TEXT,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  org_unit_id  INTEGER REFERENCES org_units(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
