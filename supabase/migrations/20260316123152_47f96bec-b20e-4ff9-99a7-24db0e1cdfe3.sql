
CREATE TABLE public.dish_dna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  component_name text NOT NULL,
  component_icon text NOT NULL DEFAULT '🍽️',
  selected_score integer NOT NULL,
  selected_tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, user_id, component_name)
);

ALTER TABLE public.dish_dna ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read dish_dna" ON public.dish_dna FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert own dish_dna" ON public.dish_dna FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own dish_dna" ON public.dish_dna FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own dish_dna" ON public.dish_dna FOR DELETE TO authenticated USING (auth.uid() = user_id);
