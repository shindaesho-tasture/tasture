
-- Add image_url column to menu_items
ALTER TABLE public.menu_items ADD COLUMN image_url text DEFAULT NULL;

-- Create storage bucket for menu item images
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images', 'menu-images', true);

-- RLS: Anyone can view menu images
CREATE POLICY "Menu images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'menu-images');

-- RLS: Authenticated users can upload menu images
CREATE POLICY "Authenticated users can upload menu images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'menu-images');

-- RLS: Users can update their own menu images
CREATE POLICY "Users can update own menu images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'menu-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: Users can delete their own menu images
CREATE POLICY "Users can delete own menu images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'menu-images' AND auth.uid()::text = (storage.foldername(name))[1]);
