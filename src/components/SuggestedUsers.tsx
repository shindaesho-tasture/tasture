import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { UserPlus, UserCheck, Sparkles } from "lucide-react";
import LazyImage from "@/components/ui/lazy-image";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface SuggestedUser {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  sharedStores: number;
  isFollowing: boolean;
}

interface SuggestedUsersProps {
  userId: string;
  followingIds: Set<string>;
  onFollowChange?: () => void;
}

const SuggestedUsers = ({ userId, followingIds, onFollowChange }: SuggestedUsersProps) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [localFollowing, setLocalFollowing] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSuggestions();
  }, [userId]);

  useEffect(() => {
    setLocalFollowing(new Set(followingIds));
  }, [followingIds]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      // 1. Get stores the current user has reviewed (via menu_reviews → menu_items)
      const { data: myReviews } = await supabase
        .from("menu_reviews")
        .select("menu_item_id, menu_items(store_id)")
        .eq("user_id", userId);

      const myStoreIds = new Set<string>();
      (myReviews || []).forEach((r: any) => {
        if (r.menu_items?.store_id) myStoreIds.add(r.menu_items.store_id);
      });

      if (myStoreIds.size === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // 2. Get menu_items from those stores
      const { data: storeMenuItems } = await supabase
        .from("menu_items")
        .select("id, store_id")
        .in("store_id", [...myStoreIds]);

      const menuItemToStore = new Map<string, string>();
      (storeMenuItems || []).forEach((m) => menuItemToStore.set(m.id, m.store_id));
      const menuItemIds = [...menuItemToStore.keys()];

      if (menuItemIds.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // 3. Find other users who reviewed these menu items
      const { data: otherReviews } = await supabase
        .from("menu_reviews")
        .select("user_id, menu_item_id")
        .in("menu_item_id", menuItemIds.slice(0, 100))
        .neq("user_id", userId);

      // Count shared stores per user
      const userStoreMap = new Map<string, Set<string>>();
      (otherReviews || []).forEach((r) => {
        const storeId = menuItemToStore.get(r.menu_item_id);
        if (!storeId) return;
        if (!userStoreMap.has(r.user_id)) userStoreMap.set(r.user_id, new Set());
        userStoreMap.get(r.user_id)!.add(storeId);
      });

      // Sort by shared stores, exclude already following
      const candidates = [...userStoreMap.entries()]
        .filter(([uid]) => !followingIds.has(uid))
        .map(([uid, stores]) => ({ uid, sharedStores: stores.size }))
        .sort((a, b) => b.sharedStores - a.sharedStores)
        .slice(0, 10);

      if (candidates.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // 4. Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", candidates.map((c) => c.uid));

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      const suggested: SuggestedUser[] = candidates
        .filter((c) => profileMap.has(c.uid))
        .map((c) => {
          const p = profileMap.get(c.uid)!;
          return {
            id: p.id,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            sharedStores: c.sharedStores,
            isFollowing: false,
          };
        });

      setUsers(suggested);
    } catch (err) {
      console.error("Suggestion fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (targetId: string) => {
    const was = localFollowing.has(targetId);
    setLocalFollowing((prev) => {
      const next = new Set(prev);
      was ? next.delete(targetId) : next.add(targetId);
      return next;
    });

    if (was) {
      await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", targetId);
    } else {
      navigator.vibrate?.(8);
      await supabase.from("follows").insert({ follower_id: userId, following_id: targetId });
    }
    onFollowChange?.();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-card animate-pulse">
            <div className="w-12 h-12 rounded-full bg-secondary" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 bg-secondary rounded" />
              <div className="h-2.5 w-32 bg-secondary rounded" />
            </div>
            <div className="w-20 h-8 bg-secondary rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-score-emerald" />
        <h3 className="text-sm font-semibold text-foreground">แนะนำให้ติดตาม</h3>
        <span className="text-[10px] text-muted-foreground">จากร้านที่คุณเคยรีวิว</span>
      </div>

      <div className="space-y-2">
        {users.map((u, i) => {
          const following = localFollowing.has(u.id);
          return (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-2xl bg-card shadow-luxury border border-border/30"
            >
              <div
                onClick={() => navigate(`/user/${u.id}`)}
                className="w-12 h-12 rounded-full bg-secondary overflow-hidden shrink-0 ring-2 ring-border/20 cursor-pointer active:scale-95 transition-transform"
              >
                {u.avatar_url ? (
                  <LazyImage src={u.avatar_url} alt="" className="w-full h-full object-cover" transformWidth={96} quality={80}
                    fallback={<div className="w-full h-full flex items-center justify-center text-base font-semibold text-muted-foreground">{(u.display_name || "?").charAt(0)}</div>} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-base font-semibold text-muted-foreground">
                    {(u.display_name || "?").charAt(0)}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0" onClick={() => navigate(`/user/${u.id}`)} role="button">
                <p className="text-sm font-semibold text-foreground truncate cursor-pointer">
                  {u.display_name || "ผู้ใช้"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  🏪 ร้านเดียวกัน {u.sharedStores} ร้าน
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => toggleFollow(u.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-semibold transition-all",
                  following
                    ? "bg-score-emerald/10 text-score-emerald border border-score-emerald/30"
                    : "bg-foreground text-background"
                )}
              >
                {following ? <UserCheck size={12} /> : <UserPlus size={12} />}
                {following ? "ติดตามแล้ว" : "ติดตาม"}
              </motion.button>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
};

export default SuggestedUsers;
