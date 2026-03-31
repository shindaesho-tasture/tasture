
ALTER TABLE public.menu_items
ADD COLUMN noodle_style_prices jsonb NOT NULL DEFAULT '{}'::jsonb;
