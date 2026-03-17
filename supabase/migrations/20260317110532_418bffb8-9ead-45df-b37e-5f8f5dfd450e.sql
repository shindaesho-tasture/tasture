
-- Create post_images table for multiple images per post, each optionally linked to a review
CREATE TABLE public.post_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  menu_review_id uuid REFERENCES public.menu_reviews(id) ON DELETE SET NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read post_images"
  ON public.post_images FOR SELECT USING (true);

CREATE POLICY "Users can insert own post_images"
  ON public.post_images FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_images.post_id AND posts.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own post_images"
  ON public.post_images FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_images.post_id AND posts.user_id = auth.uid())
  );

CREATE INDEX idx_post_images_post_id ON public.post_images(post_id);
