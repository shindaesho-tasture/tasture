
-- Create reviews table to store per-store feedback scores
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  metric_id text NOT NULL,
  score integer NOT NULL CHECK (score >= -2 AND score <= 2),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id, metric_id)
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews (for computing averages)
CREATE POLICY "Anyone can read reviews" ON public.reviews
  FOR SELECT TO public USING (true);

-- Authenticated users can insert their own reviews
CREATE POLICY "Users can insert own reviews" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews" ON public.reviews
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews" ON public.reviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
