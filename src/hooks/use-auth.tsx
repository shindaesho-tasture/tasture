import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [banned, setBanned] = useState(false);
  const checkedRef = useRef<string | null>(null);

  const checkBanned = useCallback(async (userId: string) => {
    // Deduplicate: only check once per user
    if (checkedRef.current === userId) return;
    checkedRef.current = userId;

    const { data } = await supabase
      .from("profiles")
      .select("banned")
      .eq("id", userId)
      .maybeSingle();
    if ((data as any)?.banned) {
      setBanned(true);
      await supabase.auth.signOut();
      setUser(null);
      checkedRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) checkBanned(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const newUser = session?.user ?? null;
      setUser(newUser);
      setLoading(false);
      if (newUser) checkBanned(newUser.id);
      else checkedRef.current = null;
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkBanned]);

  const signOut = async () => {
    checkedRef.current = null;
    await supabase.auth.signOut();
  };

  return { user, loading, signOut, banned };
};
