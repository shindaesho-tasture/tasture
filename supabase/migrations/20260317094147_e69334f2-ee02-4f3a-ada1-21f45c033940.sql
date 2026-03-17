
-- Enable realtime for menu_reviews and dish_dna tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dish_dna;
