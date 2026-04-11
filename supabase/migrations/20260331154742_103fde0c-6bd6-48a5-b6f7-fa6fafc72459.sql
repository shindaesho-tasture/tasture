CREATE TABLE IF NOT EXISTS public.menu_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_addons ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'อื่นๆ';