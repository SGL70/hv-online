ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check
  CHECK (type = ANY (ARRAY['övning','utbildning','möte','övrigt','kfö','söf','söb']));
