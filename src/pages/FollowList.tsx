import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, UserPlus, UserCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";
import PageTransition from "@/components/PageTransition";
import LazyImage from "@/components/ui/lazy-image";

interface FollowUser {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  isFollowing: boolean;
}

type Tab = "followers" | "following";

const FollowList = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "followers";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState({ followers: 0, following: 0 });

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user, tab]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Get counts
    const [{ count: fc }, { count: fgc }] = await Promise.all([
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", user.id),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", user.id),
    ]);
    setCounts({ followers: fc || 0, following: fgc || 0 });

    // Get list based on tab
    let userIds: string[] = [];
    if (tab === "followers") {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", user.id)
        .order("created_at", { ascending: false });
      userIds = (data || []).map((d) => d.follower_id);
    } else {
      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .order("created_at", { ascending: false });
      userIds = (data || []).map((d) => d.following_id);
    }

    if (userIds.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    // Get profiles + my follow state
    const [{ data: profiles }, { data: myFollows }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds),
      supabase.from("follows").select("following_id").eq("follower_id", user.id).in("following_id", userIds),
    ]);

    const followSet = new Set((myFollows || []).map((f) => f.following_id));
    setFollowingSet(followSet);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
    const sorted = userIds
      .filter((id) => profileMap.has(id))
      .map((id) => {
        const p = profileMap.get(id)!;
        return {
          id: p.id,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          isFollowing: followSet.has(p.id),
        };
      });

    setUsers(sorted);
    setLoading(false);
  };

  const toggleFollow = async (targetId: string) => {
    if (!user || user.id === targetId) return;
    const isNowFollowing = followingSet.has(targetId);

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === targetId ? { ...u, isFollowing: !isNowFollowing } : u))
    );
    setFollowingSet((prev) => {
      const next = new Set(prev);
      isNowFollowing ? next.delete(targetId) : next.add(targetId);
      return next;
    });

    if (isNowFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
    } else {
      navigator.vibrate?.(8);
      await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId });
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/30">
          <div className="flex items-center gap-3 px-4 py-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center"
            >
              <ArrowLeft size={16} className="text-foreground" />
            </motion.button>
            <h1 className="text-base font-semibold text-foreground">{t("followList.title", language)}</h1>
          </div>

          {/* Tabs */}
          <div className="flex px-4 gap-1 pb-2">
            {([
              { key: "followers" as Tab, label: t("followList.followers", language), count: counts.followers },
              { key: "following" as Tab, label: t("followList.following", language), count: counts.following },
            ]).map((t) => (
              <motion.button
                key={t.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all",
                  tab === t.key
                    ? "bg-score-emerald text-white shadow-[0_2px_12px_hsl(163_78%_20%/0.3)]"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {t.label} ({t.count})
              </motion.button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="px-4 py-3 space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-card animate-pulse">
                <div className="w-11 h-11 rounded-full bg-secondary" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 bg-secondary rounded" />
                  <div className="h-2.5 w-16 bg-secondary rounded" />
                </div>
                <div className="w-20 h-8 bg-secondary rounded-full" />
              </div>
            ))
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <Users size={32} className="text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {tab === "followers" ? t("followList.noFollowers", language) : t("followList.noFollowing", language)}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {users.map((u, i) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-card shadow-luxury border border-border/30"
                >
                  {/* Avatar */}
                  <div
                    onClick={() => navigate(`/user/${u.id}`)}
                    className="w-11 h-11 rounded-full bg-secondary overflow-hidden shrink-0 ring-2 ring-border/20 cursor-pointer active:scale-95 transition-transform"
                  >
                    {u.avatar_url ? (
                      <LazyImage src={u.avatar_url} alt="" className="w-full h-full object-cover" transformWidth={80} quality={80}
                        fallback={<div className="w-full h-full flex items-center justify-center text-sm font-semibold text-muted-foreground">{(u.display_name || "?").charAt(0)}</div>} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-muted-foreground">
                        {(u.display_name || "?").charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0" onClick={() => navigate(`/user/${u.id}`)} role="button">
                    <p className="text-sm font-semibold text-foreground truncate cursor-pointer">
                      {u.display_name || t("feed.user", language)}
                    </p>
                  </div>

                  {/* Follow button */}
                  {user && user.id !== u.id && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleFollow(u.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-semibold transition-all",
                        u.isFollowing
                          ? "bg-score-emerald/10 text-score-emerald border border-score-emerald/30"
                          : "bg-foreground text-background"
                      )}
                    >
                      {u.isFollowing ? <UserCheck size={12} /> : <UserPlus size={12} />}
                      {u.isFollowing ? t("feed.following", language) : t("feed.follow", language)}
                    </motion.button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default FollowList;
