CREATE TABLE IF NOT EXISTS inventories (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_unit_id  INTEGER REFERENCES org_units(id),
  initiated_by INTEGER REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','submitted')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  deadline     DATE
);

CREATE INDEX IF NOT EXISTS inventories_user_status ON inventories(user_id, status);
