-- Enforce google_place_id as NOT NULL — run AFTER StoreRegistration is updated
-- to always capture a Google Place ID before inserting a store.
--
-- First remove any legacy stores that have no google_place_id
-- (they cannot be matched to Google Places and are no longer valid).
DELETE FROM public.stores WHERE google_place_id IS NULL;

ALTER TABLE public.stores
  ALTER COLUMN google_place_id SET NOT NULL;
