
CREATE TABLE public.menu_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  language text NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, language)
);

ALTER TABLE public.menu_translations ENABLE ROW LEVEL SECURITY;

-- Anyone can read translations
CREATE POLICY "Anyone can read menu_translations"
ON public.menu_translations FOR SELECT TO public
USING (true);

-- Store owners can manage translations for their menu items
CREATE POLICY "Store owners can insert menu_translations"
ON public.menu_translations FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM menu_items mi JOIN stores s ON s.id = mi.store_id
  WHERE mi.id = menu_translations.menu_item_id AND s.user_id = auth.uid()
));

CREATE POLICY "Store owners can update menu_translations"
ON public.menu_translations FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM menu_items mi JOIN stores s ON s.id = mi.store_id
  WHERE mi.id = menu_translations.menu_item_id AND s.user_id = auth.uid()
));

CREATE POLICY "Store owners can delete menu_translations"
ON public.menu_translations FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM menu_items mi JOIN stores s ON s.id = mi.store_id
  WHERE mi.id = menu_translations.menu_item_id AND s.user_id = auth.uid()
));

-- Admins can manage all translations
CREATE POLICY "Admins can manage menu_translations"
ON public.menu_translations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
