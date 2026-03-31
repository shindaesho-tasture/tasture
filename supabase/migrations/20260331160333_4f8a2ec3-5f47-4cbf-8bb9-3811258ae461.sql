
-- Admin can insert menu items for any store
CREATE POLICY "Admins can insert menu items"
ON public.menu_items FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin can update menu items for any store
CREATE POLICY "Admins can update menu items"
ON public.menu_items FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can delete menu items for any store
CREATE POLICY "Admins can delete menu items"
ON public.menu_items FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can insert menu addons for any item
CREATE POLICY "Admins can insert menu_addons"
ON public.menu_addons FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin can update menu addons for any item
CREATE POLICY "Admins can update menu_addons"
ON public.menu_addons FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin can delete menu addons for any item
CREATE POLICY "Admins can delete menu_addons"
ON public.menu_addons FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
