
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS verification_first_name text,
  ADD COLUMN IF NOT EXISTS verification_last_name text,
  ADD COLUMN IF NOT EXISTS verification_email text,
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz;
