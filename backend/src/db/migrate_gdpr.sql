-- GDPR: internt Hv-ID som primärnyckel + stöd för anonymisering
-- personal_number är inte garanterat unikt inom Hemvärnet (används ofta utan de
-- fyra sista siffrorna), och ska kunna rensas när en person anonymiseras.

ALTER TABLE users ALTER COLUMN personal_number DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS hv_id TEXT GENERATED ALWAYS AS
  ('HV-' || LPAD(id::text, 6, '0')) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS users_hv_id_idx ON users(hv_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;
