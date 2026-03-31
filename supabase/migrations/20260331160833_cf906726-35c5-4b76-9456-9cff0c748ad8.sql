
ALTER TABLE public.menu_items
ADD COLUMN noodle_type_prices jsonb NOT NULL DEFAULT '{}'::jsonb;
