
-- Menu reviews table: per-user feedback on individual menu items
CREATE TABLE public.menu_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score integer NOT NULL CHECK (score IN (-2, 0, 2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, user_id)
);

ALTER TABLE public.menu_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY "Anyone can read menu_reviews" ON public.menu_reviews
  FOR SELECT TO public USING (true);

-- Users can insert own
CREATE POLICY "Users can insert own menu_reviews" ON public.menu_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update own
CREATE POLICY "Users can update own menu_reviews" ON public.menu_reviews
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Users can delete own
CREATE POLICY "Users can delete own menu_reviews" ON public.menu_reviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
