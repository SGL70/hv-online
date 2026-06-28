ALTER TABLE equipment_cases ADD COLUMN IF NOT EXISTS afse_generated_at TIMESTAMPTZ;
ALTER TABLE equipment_cases ADD COLUMN IF NOT EXISTS material_received_at TIMESTAMPTZ;
ALTER TABLE equipment_cases ADD COLUMN IF NOT EXISTS material_received_by INTEGER REFERENCES users(id);
