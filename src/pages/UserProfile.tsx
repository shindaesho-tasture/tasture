import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Gem, Store, Users, ChefHat, UserPlus, UserCheck, Crown, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { getScoreTier, type ScoreTier } from "@/lib/categories";
import PageTransition from "@/components/PageTransition";

interface PublicProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface RecentReview {
  id: string;
  menuItemName: string;
  menuItemImage: string | null;
  storeName: string;
  storeId: string;
  score: number;
  createdAt: string;
}

const tierColors: Record<ScoreTier, string> = {
  emerald: "text-score-emerald",
  mint: "text-score-mint",
  slate: "text-score-slate",
  amber: "text-score-amber",
  ruby: "text-score-ruby",
};
const tierBg: Record<ScoreTier, string> = {
  emerald: "bg-score-emerald/10",
  mint: "bg-score-mint/10",
  slate: "bg-score-slate/10",
  amber: "bg-score-amber/10",
  ruby: "bg-score-ruby/10",
};

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาที`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} วัน`;
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
};

const ACHIEVEMENTS = [
  { id: "first-emerald", icon: "💎", titleTh: "เพชรดวงแรก", check: (e: number) => e >= 1, tier: "emerald" },
  { id: "emerald-5", icon: "💎", titleTh: "นักสะสมเพชร", check: (e: number) => e >= 5, tier: "emerald" },
  { id: "emerald-20", icon: "👑", titleTh: "มงกุฎเพชร", check: (e: number) => e >= 20, tier: "gold" },
] as const;

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [stats, setStats] = useState({ emeralds: 0, stores: 0, followers: 0, following: 0 });
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);

  const isMe = me?.id === userId;

  useEffect(() => {
    if (!userId) return;
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    if (!userId) return;
    setLoading(true);

    const [{ data: prof }, { count: emeralds }, { data: storeReviews }, { count: followers }, { count: following }] =
      await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_url, email").eq("id", userId).single(),
        supabase.from("menu_reviews").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("score", 2),
        supabase.from("menu_reviews").select("menu_item_id, menu_items(store_id)").eq("user_id", userId),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
      ]);

    setProfile(prof);
    const uniqueStores = new Set<string>();
    (storeReviews || []).forEach((r: any) => {
      const storeId = r.menu_items?.store_id;
      if (storeId) uniqueStores.add(storeId);
    });
    setStats({
      emeralds: emeralds || 0,
      stores: uniqueStores.size,
      followers: followers || 0,
      following: following || 0,
    });

    // Check if I follow this user
    if (me && me.id !== userId) {
      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", me.id)
        .eq("following_id", userId)
        .maybeSingle();
      setIsFollowing(!!data);
    }

    // Fetch recent reviews
    const { data: reviews } = await supabase
      .from("menu_reviews")
      .select("id, score, created_at, menu_item_id, menu_items(name, image_url, store_id, stores(name))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    const mapped: RecentReview[] = (reviews || []).map((r: any) => ({
      id: r.id,
      menuItemName: r.menu_items?.name || "เมนู",
      menuItemImage: r.menu_items?.image_url || null,
      storeName: r.menu_items?.stores?.name || "ร้านค้า",
      storeId: r.menu_items?.store_id || "",
      score: r.score,
      createdAt: r.created_at,
    }));
    setRecentReviews(mapped);

    setLoading(false);
  };

  const toggleFollow = async () => {
    if (!me || !userId || isMe) return;
    const was = isFollowing;
    setIsFollowing(!was);
    setStats((s) => ({ ...s, followers: s.followers + (was ? -1 : 1) }));

    if (was) {
      await supabase.from("follows").delete().eq("follower_id", me.id).eq("following_id", userId);
    } else {
      navigator.vibrate?.(8);
      await supabase.from("follows").insert({ follower_id: me.id, following_id: userId });
    }
  };

  const unlockedBadges = ACHIEVEMENTS.filter((a) => a.check(stats.emeralds));

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-score-emerald border-t-transparent rounded-full animate-spin" />
        </div>
      </PageTransition>
    );
  }

  if (!profile) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
          <p className="text-muted-foreground">ไม่พบผู้ใช้</p>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate(-1)} className="px-4 py-2 rounded-full bg-secondary text-sm">
            กลับ
          </motion.button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-8">
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
            <h1 className="text-base font-semibold text-foreground truncate">
              {profile.display_name || "ผู้ใช้"}
            </h1>
          </div>
        </div>

        {/* Profile Card */}
        <div className="flex flex-col items-center pt-8 pb-6 px-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 rounded-full bg-secondary overflow-hidden ring-4 ring-border/20 shadow-luxury mb-4"
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted-foreground">
                {(profile.display_name || "?").charAt(0)}
              </div>
            )}
          </motion.div>

          <motion.h2
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-xl font-bold text-foreground"
          >
            {profile.display_name || "ผู้ใช้"}
          </motion.h2>

          {/* Follow Button */}
          {me && !isMe && (
            <motion.button
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleFollow}
              className={cn(
                "mt-4 flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all",
                isFollowing
                  ? "bg-score-emerald/10 text-score-emerald border border-score-emerald/30"
                  : "bg-foreground text-background"
              )}
            >
              {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
              {isFollowing ? "ติดตามแล้ว" : "ติดตาม"}
            </motion.button>
          )}

          {isMe && (
            <motion.button
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/profile")}
              className="mt-4 px-6 py-2.5 rounded-full bg-secondary text-sm font-semibold text-foreground"
            >
              แก้ไขโปรไฟล์
            </motion.button>
          )}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mx-6 grid grid-cols-4 gap-2.5 mb-8"
        >
          {[
            { icon: Gem, label: "Emeralds", value: stats.emeralds },
            { icon: Store, label: "Stores", value: stats.stores },
            { icon: Users, label: "ผู้ติดตาม", value: stats.followers },
            { icon: ChefHat, label: "ติดตาม", value: stats.following },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex flex-col items-center py-3.5 rounded-2xl bg-card shadow-luxury">
              <Icon size={16} strokeWidth={1.5} className="text-score-emerald mb-1" />
              <span className="text-lg font-bold text-foreground">{value}</span>
              <span className="text-[9px] text-muted-foreground font-medium mt-0.5">{label}</span>
            </div>
          ))}
        </motion.div>

        {/* Badges */}
        {unlockedBadges.length > 0 && (
          <motion.section
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mx-6 mb-8"
          >
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="text-base">🏆</span> Achievements
            </h2>
            <div className="flex gap-2.5 flex-wrap">
              {unlockedBadges.map((badge) => {
                const colors = {
                  emerald: "bg-score-emerald/10 shadow-[0_0_0_1.5px_hsl(163,78%,20%)]",
                  gold: "bg-gold/10 shadow-[0_0_0_1.5px_hsl(43,74%,49%)]",
                  ruby: "bg-score-ruby/10 shadow-[0_0_0_1.5px_hsl(0,68%,35%)]",
                };
                return (
                  <div
                    key={badge.id}
                    className={cn("flex flex-col items-center p-2.5 rounded-xl", colors[badge.tier])}
                  >
                    <span className="text-xl mb-1">{badge.icon}</span>
                    <span className="text-[9px] font-semibold text-foreground">{badge.titleTh}</span>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}
      </div>
    </PageTransition>
  );
};

export default UserProfile;
