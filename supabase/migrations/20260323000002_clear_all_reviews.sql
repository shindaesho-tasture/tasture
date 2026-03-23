-- Clear all reviews to start fresh with Tasture's own feedback system
-- dish_dna and menu_reviews must be deleted before reviews (FK constraints)
DELETE FROM public.dish_dna;
DELETE FROM public.menu_reviews;
DELETE FROM public.reviews;
