
-- Create stores table
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category_id TEXT,
  pin_lat DOUBLE PRECISION,
  pin_lng DOUBLE PRECISION,
  menu_photo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create menu_items table
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'standard',
  price NUMERIC NOT NULL DEFAULT 0,
  price_special NUMERIC,
  noodle_types TEXT[] DEFAULT '{}',
  noodle_styles TEXT[] DEFAULT '{}',
  toppings TEXT[] DEFAULT '{}',
  rating INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Stores: anyone can read, authenticated users can insert their own
CREATE POLICY "Anyone can read stores" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Users can insert own stores" ON public.stores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stores" ON public.stores FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stores" ON public.stores FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Menu items: anyone can read, authenticated users can manage items of their stores
CREATE POLICY "Anyone can read menu items" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "Users can insert menu items for own stores" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND user_id = auth.uid()));
CREATE POLICY "Users can update menu items for own stores" ON public.menu_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete menu items for own stores" ON public.menu_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND user_id = auth.uid()));

-- Create profiles table for user info
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
