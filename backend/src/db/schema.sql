-- Bataljonssystem schema

CREATE TABLE IF NOT EXISTS org_units (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bataljon', 'kompani', 'pluton', 'tropp', 'grupp', 'stab')),
  parent_id INTEGER REFERENCES org_units(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  personal_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'soldat' CHECK (role IN ('soldat','grpc','pc','toc','kompc','kvm','s4','batCh','stab')),
  org_unit_id INTEGER REFERENCES org_units(id) ON DELETE SET NULL,
  email TEXT,
  mobile TEXT,
  profile_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('övning','utbildning','möte','övrigt')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  org_unit_id INTEGER NOT NULL REFERENCES org_units(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_responses (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('ja','nej','kanske')),
  actual_attendance BOOLEAN,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(activity_id, user_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
  report_date DATE NOT NULL,
  hours NUMERIC(5,2) DEFAULT 0,
  km INTEGER DEFAULT 0,
  expenses NUMERIC(10,2) DEFAULT 0,
  expense_description TEXT,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','reviewed','approved','rejected')),
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_number TEXT,
  name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'ok' CHECK (status IN ('ok','ej_mottagen','ej_tilldelad','förlustanmäld','byte_pågår')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment_templates (
  id SERIAL PRIMARY KEY,
  org_unit_id INTEGER NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
  article_number TEXT,
  name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS equipment_cases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('ej_mottagen','beställning','förlust')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','pc_review','approved','rejected','fulfilled')),
  description TEXT,
  pc_comment TEXT,
  reviewer_id INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_members (
  id SERIAL PRIMARY KEY,
  personal_number TEXT UNIQUE NOT NULL,
  org_unit_id INTEGER NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'soldat',
  added_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
