
-- Cache table for Gemini dish analysis, keyed by normalized dish name
CREATE TABLE public.dish_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_name text NOT NULL UNIQUE,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dish_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can read templates
CREATE POLICY "Anyone can read dish_templates" ON public.dish_templates FOR SELECT TO public USING (true);
-- Only authenticated users can insert (triggered by scanning)
CREATE POLICY "Authenticated can insert dish_templates" ON public.dish_templates FOR INSERT TO authenticated WITH CHECK (true);
-- Only authenticated users can update
CREATE POLICY "Authenticated can update dish_templates" ON public.dish_templates FOR UPDATE TO authenticated USING (true);
