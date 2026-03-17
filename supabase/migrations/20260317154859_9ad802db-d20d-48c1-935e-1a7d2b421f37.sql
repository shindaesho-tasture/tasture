-- Site config table for admin-editable settings (categories, metrics, etc.)
CREATE TABLE public.site_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read config
CREATE POLICY "Anyone can read site_config"
ON public.site_config FOR SELECT
USING (true);

-- Only admins can modify config
CREATE POLICY "Admins can manage site_config"
ON public.site_config FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default categories
INSERT INTO public.site_config (key, value) VALUES ('categories', '[]'::jsonb);
