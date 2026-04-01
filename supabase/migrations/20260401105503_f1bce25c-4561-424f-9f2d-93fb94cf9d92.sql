
CREATE OR REPLACE FUNCTION public.add_store_member_by_email(
  _store_id uuid,
  _email text,
  _role text DEFAULT 'staff'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_role text;
  _target_user_id uuid;
BEGIN
  -- Check caller is owner or manager
  _caller_role := get_store_role(auth.uid(), _store_id);
  IF _caller_role IS NULL OR _caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- Validate role
  IF _role NOT IN ('manager', 'staff') THEN
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  -- Look up user by email
  SELECT id INTO _target_user_id
  FROM profiles
  WHERE LOWER(email) = LOWER(_email);

  IF _target_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  -- Check not already a member or owner
  IF EXISTS (SELECT 1 FROM stores WHERE id = _store_id AND user_id = _target_user_id) THEN
    RETURN jsonb_build_object('error', 'Already owner');
  END IF;

  IF EXISTS (SELECT 1 FROM store_members WHERE store_id = _store_id AND user_id = _target_user_id) THEN
    RETURN jsonb_build_object('error', 'Already a member');
  END IF;

  -- Insert member
  INSERT INTO store_members (store_id, user_id, role)
  VALUES (_store_id, _target_user_id, _role);

  RETURN jsonb_build_object('success', true, 'user_id', _target_user_id);
END;
$$;
