
-- Create feed comments table
CREATE TABLE public.feed_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  -- Reference type: 'menu_review' or 'dish_dna'
  ref_type TEXT NOT NULL,
  -- For menu_review: the review id; for dish_dna: composite key "userId-menuItemId"
  ref_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments"
ON public.feed_comments FOR SELECT
USING (true);

CREATE POLICY "Users can insert own comments"
ON public.feed_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
ON public.feed_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_feed_comments_ref ON public.feed_comments (ref_type, ref_id);
CREATE INDEX idx_feed_comments_created ON public.feed_comments (created_at DESC);
