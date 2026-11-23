-- Run once in the Neon SQL editor for the production database.
-- Safe to rerun; this is not automatically applied by Vercel.
CREATE TABLE IF NOT EXISTS public.device_lid_alerts (
  device_id uuid PRIMARY KEY REFERENCES public.device_registrations(id) ON DELETE CASCADE,
  opened_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  notified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
