ALTER TABLE public.menu_items ADD COLUMN original_name TEXT;
ALTER TABLE public.menu_items ADD COLUMN description TEXT;
ALTER TABLE public.menu_items ADD COLUMN textures TEXT[] DEFAULT '{}'::text[];