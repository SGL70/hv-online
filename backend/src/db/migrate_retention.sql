-- Retention: markera när en person slutade tjänstgöra, så att retention-kandidater
-- (kontaktdata: aktiv + 1 år efter avslut) kan beräknas.

ALTER TABLE users ADD COLUMN IF NOT EXISTS service_ended_at TIMESTAMPTZ;
