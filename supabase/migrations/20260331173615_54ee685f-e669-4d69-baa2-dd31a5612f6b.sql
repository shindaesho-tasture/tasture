
CREATE TABLE public.tag_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_text text NOT NULL,
  language text NOT NULL,
  translated_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag_text, language)
);

ALTER TABLE public.tag_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tag_translations"
ON public.tag_translations FOR SELECT TO public
USING (true);

CREATE POLICY "Admins can manage tag_translations"
ON public.tag_translations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
