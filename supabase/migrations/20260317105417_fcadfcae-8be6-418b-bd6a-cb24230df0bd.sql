
-- Update notify_on_like to handle both review posts (userId-menuItemId format) and photo posts (UUID format)
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  post_owner_id UUID;
  liker_name TEXT;
  is_photo_post BOOLEAN;
BEGIN
  -- Check if ref_id is a photo post UUID (exists in posts table)
  SELECT user_id INTO post_owner_id FROM public.posts WHERE id::text = NEW.ref_id;
  is_photo_post := post_owner_id IS NOT NULL;

  -- If not a photo post, try the old userId-menuItemId format
  IF NOT is_photo_post THEN
    BEGIN
      post_owner_id := (string_to_array(NEW.ref_id, '-'))[1]::UUID;
    EXCEPTION WHEN OTHERS THEN
      RETURN NEW;
    END;
  END IF;

  IF post_owner_id IS NULL OR post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, 'ผู้ใช้') INTO liker_name
  FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, ref_type, ref_id, actor_id)
  VALUES (
    post_owner_id,
    'like',
    liker_name || ' ถูกใจโพสของคุณ',
    CASE WHEN is_photo_post THEN 'กดถูกใจรูปอาหารของคุณ' ELSE 'กดถูกใจรีวิวของคุณ' END,
    'post',
    NEW.ref_id,
    NEW.user_id
  );

  RETURN NEW;
END;
$function$;

-- Update notify_on_comment to handle both formats
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  post_owner_id UUID;
  commenter_name TEXT;
  comment_preview TEXT;
  is_photo_post BOOLEAN;
BEGIN
  -- Check if ref_id is a photo post UUID
  SELECT user_id INTO post_owner_id FROM public.posts WHERE id::text = NEW.ref_id;
  is_photo_post := post_owner_id IS NOT NULL;

  -- If not a photo post, try old format
  IF NOT is_photo_post THEN
    BEGIN
      post_owner_id := (string_to_array(NEW.ref_id, '-'))[1]::UUID;
    EXCEPTION WHEN OTHERS THEN
      RETURN NEW;
    END;
  END IF;

  IF post_owner_id IS NULL OR post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, 'ผู้ใช้') INTO commenter_name
  FROM public.profiles WHERE id = NEW.user_id;

  comment_preview := LEFT(NEW.content, 80);
  IF LENGTH(NEW.content) > 80 THEN
    comment_preview := comment_preview || '…';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, ref_type, ref_id, actor_id)
  VALUES (
    post_owner_id,
    'comment',
    commenter_name || ' คอมเมนต์ในโพสของคุณ',
    comment_preview,
    NEW.ref_type,
    NEW.ref_id,
    NEW.user_id
  );

  RETURN NEW;
END;
$function$;

-- Create triggers (drop first if they exist)
DROP TRIGGER IF EXISTS on_new_like ON public.post_likes;
CREATE TRIGGER on_new_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_like();

DROP TRIGGER IF EXISTS on_new_comment ON public.feed_comments;
CREATE TRIGGER on_new_comment
  AFTER INSERT ON public.feed_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_comment();

DROP TRIGGER IF EXISTS on_new_follow ON public.follows;
CREATE TRIGGER on_new_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_follow();
