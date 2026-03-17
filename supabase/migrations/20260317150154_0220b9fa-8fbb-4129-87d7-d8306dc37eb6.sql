-- Add banned flag to profiles
ALTER TABLE public.profiles ADD COLUMN banned boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN ban_reason text;

-- Add hidden flag to posts
ALTER TABLE public.posts ADD COLUMN hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.posts ADD COLUMN hide_reason text;

-- Add hidden flag to menu_reviews
ALTER TABLE public.menu_reviews ADD COLUMN hidden boolean NOT NULL DEFAULT false;