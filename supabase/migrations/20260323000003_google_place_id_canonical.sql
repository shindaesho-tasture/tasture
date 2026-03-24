-- Add has_tasture_content flag to distinguish stores with real app content
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS has_tasture_content BOOLEAN NOT NULL DEFAULT false;

-- Function: auto-sync has_tasture_content whenever menu_items change
CREATE OR REPLACE FUNCTION public.sync_has_tasture_content()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.stores SET has_tasture_content = true WHERE id = NEW.store_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.stores
      SET has_tasture_content = EXISTS (
        SELECT 1 FROM public.menu_items WHERE store_id = OLD.store_id
      )
    WHERE id = OLD.store_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_menu_items_tasture_content
AFTER INSERT OR DELETE ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.sync_has_tasture_content();

-- Backfill: mark stores that already have menu_items
UPDATE public.stores s
  SET has_tasture_content = true
  WHERE EXISTS (SELECT 1 FROM public.menu_items WHERE store_id = s.id);
