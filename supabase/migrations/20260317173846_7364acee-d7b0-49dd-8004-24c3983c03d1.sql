
-- Cache table for AI-generated dish component descriptions
CREATE TABLE public.dish_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL,
  component_name text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(menu_item_id, component_name)
);

ALTER TABLE public.dish_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read dish_descriptions"
  ON public.dish_descriptions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can insert dish_descriptions"
  ON public.dish_descriptions FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update dish_descriptions"
  ON public.dish_descriptions FOR UPDATE TO authenticated
  USING (true);

CREATE INDEX idx_dish_descriptions_menu_item ON public.dish_descriptions(menu_item_id);
