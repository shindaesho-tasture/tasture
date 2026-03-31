ALTER TABLE public.dish_descriptions ADD COLUMN language text NOT NULL DEFAULT 'th';

-- Drop existing unique constraint if any and create new one with language
ALTER TABLE public.dish_descriptions DROP CONSTRAINT IF EXISTS dish_descriptions_menu_item_id_component_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS dish_descriptions_item_comp_lang_idx ON public.dish_descriptions (menu_item_id, component_name, language);