CREATE POLICY "Admins can manage dish_descriptions"
ON public.dish_descriptions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));