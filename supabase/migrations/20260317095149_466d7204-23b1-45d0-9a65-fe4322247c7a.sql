
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'comment',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  actor_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Allow system inserts (from trigger function)
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create trigger function to auto-create notification on new comment
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id UUID;
  commenter_name TEXT;
  comment_preview TEXT;
BEGIN
  -- The ref_id format is "userId-menuItemId", extract the post owner
  post_owner_id := (string_to_array(NEW.ref_id, '-'))[1]::UUID;

  -- Don't notify yourself
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get commenter display name
  SELECT COALESCE(display_name, 'ผู้ใช้') INTO commenter_name
  FROM public.profiles WHERE id = NEW.user_id;

  -- Truncate comment for preview
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
$$;

CREATE TRIGGER on_feed_comment_insert
AFTER INSERT ON public.feed_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_comment();
