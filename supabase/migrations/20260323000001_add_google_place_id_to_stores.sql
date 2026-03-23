-- Add google_place_id to stores for Google Places sync
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS google_place_id TEXT DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS stores_google_place_id_idx
  ON public.stores (google_place_id)
  WHERE google_place_id IS NOT NULL;
