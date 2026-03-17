
-- Create saved_stores table
CREATE TABLE public.saved_stores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, store_id)
);

ALTER TABLE public.saved_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saved stores"
  ON public.saved_stores FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save stores"
  ON public.saved_stores FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave stores"
  ON public.saved_stores FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_saved_stores_user ON public.saved_stores(user_id);
