
-- Create satisfaction ratings table with 5 axes
CREATE TABLE public.satisfaction_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  texture SMALLINT NOT NULL DEFAULT 3,
  taste SMALLINT NOT NULL DEFAULT 3,
  overall SMALLINT NOT NULL DEFAULT 3,
  cleanliness SMALLINT NOT NULL DEFAULT 3,
  value SMALLINT NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, menu_item_id)
);

ALTER TABLE public.satisfaction_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read satisfaction_ratings"
ON public.satisfaction_ratings FOR SELECT
USING (true);

CREATE POLICY "Users can insert own satisfaction_ratings"
ON public.satisfaction_ratings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own satisfaction_ratings"
ON public.satisfaction_ratings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own satisfaction_ratings"
ON public.satisfaction_ratings FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.satisfaction_ratings;
