ALTER TABLE members
  ADD COLUMN IF NOT EXISTS hs_driver boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pilot_heli boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pilot_avion boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS barca boolean DEFAULT false;
