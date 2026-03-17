
-- Add menu_review_id to posts table to link photo posts with reviews
ALTER TABLE public.posts ADD COLUMN menu_review_id uuid REFERENCES public.menu_reviews(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_posts_menu_review_id ON public.posts(menu_review_id);
