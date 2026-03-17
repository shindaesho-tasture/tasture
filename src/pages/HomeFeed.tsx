import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, Sparkles, Clock, ChefHat, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getScoreTier, type ScoreTier } from "@/lib/categories";
import { cn } from "@/lib/utils";
import PageTransition from "@/components/PageTransition";
import TastureHeader from "@/components/TastureHeader";
import BottomNav from "@/components/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── Types ─── */
interface FeedPost {
  id: string;
  type: "menu_review" | "dish_dna";
  userId: string;
  userName: string;
  userAvatar: string | null;
  storeName: string;
  storeId: string;
  menuItemName: string;
  menuItemId: string;
  menuItemImage: string | null;
  score: number | null;
  dnaComponents?: { name: string; icon: string; tag: string; score: number }[];
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

const scoreLabel = (score: number) => {
  if (score === 2) return "ชอบมาก 🔥";
  if (score === -2) return "ไม่ชอบ 😔";
  return "เฉยๆ 😐";
};

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} วันที่แล้ว`;
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
};

const HomeFeed = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const PULL_THRESHOLD = 80;

  useEffect(() => {
    fetchFeed();
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeed(true);
    setPullDistance(0);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        isPulling.current = true;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        setPullDistance(Math.min(dy * 0.5, 120));
        if (dy > 10) e.preventDefault();
      }
    };
    const onTouchEnd = () => {
      if (pullDistance >= PULL_THRESHOLD && !refreshing) {
        handleRefresh();
      } else {
        setPullDistance(0);
      }
      isPulling.current = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullDistance, refreshing, handleRefresh]);

  const fetchFeed = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      // Fetch recent menu reviews and dish DNA in parallel
      const [reviewsRes, dnaRes] = await Promise.all([
        supabase
          .from("menu_reviews")
          .select("id, score, user_id, menu_item_id, created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("dish_dna")
          .select("id, user_id, menu_item_id, component_name, component_icon, selected_tag, selected_score, created_at")
          .order("created_at", { ascending: false })
          .limit(60),
      ]);

      // Collect unique user_ids and menu_item_ids
      const userIds = new Set<string>();
      const menuItemIds = new Set<string>();

      (reviewsRes.data || []).forEach((r) => { userIds.add(r.user_id); menuItemIds.add(r.menu_item_id); });
      (dnaRes.data || []).forEach((d) => { userIds.add(d.user_id); menuItemIds.add(d.menu_item_id); });

      // Fetch profiles, menu items, stores
      const [profilesRes, menuItemsRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_url").in("id", [...userIds]),
        supabase.from("menu_items").select("id, name, store_id, image_url").in("id", [...menuItemIds]),
      ]);

      const profileMap = new Map<string, { name: string; avatar: string | null }>();
      (profilesRes.data || []).forEach((p) => {
        profileMap.set(p.id, { name: p.display_name || "ผู้ใช้", avatar: p.avatar_url });
      });

      const menuMap = new Map<string, { name: string; storeId: string; image: string | null }>();
      const storeIds = new Set<string>();
      (menuItemsRes.data || []).forEach((m) => {
        menuMap.set(m.id, { name: m.name, storeId: m.store_id, image: m.image_url });
        storeIds.add(m.store_id);
      });

      const { data: storesData } = await supabase.from("stores").select("id, name").in("id", [...storeIds]);
      const storeMap = new Map<string, string>();
      (storesData || []).forEach((s) => storeMap.set(s.id, s.name));

      // Build feed posts from reviews
      const reviewPosts: FeedPost[] = (reviewsRes.data || []).map((r) => {
        const profile = profileMap.get(r.user_id);
        const menu = menuMap.get(r.menu_item_id);
        return {
          id: `review-${r.id}`,
          type: "menu_review",
          userId: r.user_id,
          userName: profile?.name || "ผู้ใช้",
          userAvatar: profile?.avatar || null,
          storeName: menu ? (storeMap.get(menu.storeId) || "ร้านค้า") : "ร้านค้า",
          storeId: menu?.storeId || "",
          menuItemName: menu?.name || "เมนู",
          menuItemId: r.menu_item_id,
          menuItemImage: menu?.image || null,
          score: r.score,
          createdAt: r.created_at,
        };
      });

      // Group DNA by user+menu_item (same submission)
      const dnaGrouped = new Map<string, typeof dnaRes.data>();
      (dnaRes.data || []).forEach((d) => {
        const key = `${d.user_id}-${d.menu_item_id}`;
        if (!dnaGrouped.has(key)) dnaGrouped.set(key, []);
        dnaGrouped.get(key)!.push(d);
      });

      const dnaPosts: FeedPost[] = [...dnaGrouped.entries()].map(([key, items]) => {
        const first = items![0];
        const profile = profileMap.get(first.user_id);
        const menu = menuMap.get(first.menu_item_id);
        return {
          id: `dna-${key}`,
          type: "dish_dna",
          userId: first.user_id,
          userName: profile?.name || "ผู้ใช้",
          userAvatar: profile?.avatar || null,
          storeName: menu ? (storeMap.get(menu.storeId) || "ร้านค้า") : "ร้านค้า",
          storeId: menu?.storeId || "",
          menuItemName: menu?.name || "เมนู",
          menuItemId: first.menu_item_id,
          menuItemImage: menu?.image || null,
          score: null,
          dnaComponents: items!.map((d) => ({
            name: d.component_name,
            icon: d.component_icon,
            tag: d.selected_tag,
            score: d.selected_score,
          })),
          createdAt: first.created_at,
        };
      });

      // Merge and sort by time
      const allPosts = [...reviewPosts, ...dnaPosts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setPosts(allPosts.slice(0, 30));
    } catch (err) {
      console.error("Feed fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <PageTransition>
      <div ref={containerRef} className="min-h-screen bg-background pb-24 overflow-y-auto">
        <TastureHeader />

        {/* Pull-to-refresh indicator */}
        <motion.div
          animate={{ height: pullDistance, opacity: pullProgress }}
          transition={refreshing ? { duration: 0.2 } : { duration: 0 }}
          className="flex items-center justify-center overflow-hidden"
        >
          <motion.div
            animate={{ rotate: refreshing ? 360 : pullProgress * 180 }}
            transition={refreshing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : { duration: 0 }}
          >
            <RefreshCw
              size={20}
              className={pullProgress >= 1 ? "text-score-emerald" : "text-muted-foreground"}
            />
          </motion.div>
          {pullProgress >= 1 && !refreshing && (
            <span className="ml-2 text-[11px] font-medium text-score-emerald">ปล่อยเพื่อรีเฟรช</span>
          )}
          {refreshing && (
            <span className="ml-2 text-[11px] font-medium text-muted-foreground">กำลังโหลด…</span>
          )}
        </motion.div>

        {/* Page Title */}
        <div className="px-6 pt-2 pb-4">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            ฟีด
          </h1>
          <p className="text-sm font-light text-muted-foreground mt-1">
            รีวิวล่าสุดจากชุมชน
          </p>
        </div>

        {/* Feed */}
        <div className="px-4 space-y-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-elevated border border-border/50 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2.5 w-32" />
                  </div>
                </div>
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))
          ) : posts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-16 gap-3"
            >
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                <ChefHat size={28} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">ยังไม่มีรีวิวจากชุมชน</p>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate("/store-list")}
                className="mt-2 px-5 py-2.5 rounded-full bg-foreground text-background text-xs font-medium"
              >
                เริ่มสำรวจร้าน
              </motion.button>
            </motion.div>
          ) : (
            <AnimatePresence>
              {posts.map((post, i) => (
                <PostCard key={post.id} post={post} index={i} navigate={navigate} />
              ))}
            </AnimatePresence>
          )}
        </div>

        <BottomNav />
      </div>
    </PageTransition>
  );
};

/* ─── Post Card Component ─── */
interface PostCardProps {
  post: FeedPost;
  index: number;
  navigate: ReturnType<typeof useNavigate>;
}

const PostCard = ({ post, index, navigate }: PostCardProps) => {
  const [liked, setLiked] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="rounded-2xl bg-surface-elevated border border-border/50 shadow-luxury overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden shrink-0 ring-2 ring-border/30">
          {post.userAvatar ? (
            <img src={post.userAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm">
              {post.userName.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{post.userName}</p>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Clock size={10} />
            <span>{timeAgo(post.createdAt)}</span>
          </div>
        </div>
        <span className={cn(
          "px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide",
          post.type === "menu_review"
            ? "bg-score-amber/10 text-score-amber"
            : "bg-score-emerald/10 text-score-emerald"
        )}>
          {post.type === "menu_review" ? "⭐ รีวิว" : "🧬 DNA"}
        </span>
      </div>

      {/* Action text */}
      <div className="px-4 pb-2">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {post.type === "menu_review" ? "ให้คะแนน" : "วิเคราะห์ Dish DNA ของ"}{" "}
          <span className="font-semibold text-foreground">{post.menuItemName}</span>
          {" "}ที่{" "}
          <button
            onClick={() => navigate(`/store/${post.storeId}/order`)}
            className="font-semibold text-score-emerald hover:underline"
          >
            {post.storeName}
          </button>
        </p>
      </div>

      {/* Menu item image */}
      {post.menuItemImage && (
        <div className="px-4 pb-3">
          <motion.div
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/store/${post.storeId}/order`)}
            className="relative rounded-xl overflow-hidden cursor-pointer aspect-[16/10]"
          >
            <img
              src={post.menuItemImage}
              alt={post.menuItemName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3">
              <span className="text-xs font-semibold text-white drop-shadow-md">
                {post.menuItemName}
              </span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Score display for reviews */}
      {post.type === "menu_review" && post.score != null && (
        <div className="px-4 pb-3">
          <ScorePill score={post.score} />
        </div>
      )}

      {/* DNA Components */}
      {post.type === "dish_dna" && post.dnaComponents && post.dnaComponents.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {post.dnaComponents.slice(0, 6).map((comp, i) => {
              const tier = getScoreTier(comp.score);
              return (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold",
                    tierBg[tier],
                    tierColors[tier]
                  )}
                >
                  {comp.icon} {comp.tag}
                </span>
              );
            })}
            {post.dnaComponents.length > 6 && (
              <span className="inline-flex items-center px-2 py-1.5 rounded-xl text-[10px] text-muted-foreground bg-secondary">
                +{post.dnaComponents.length - 6}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Interaction bar */}
      <div className="flex items-center gap-1 px-4 py-3 border-t border-border/30">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => setLiked(!liked)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary transition-colors"
        >
          <Heart
            size={16}
            className={cn(
              "transition-all duration-200",
              liked ? "fill-score-ruby text-score-ruby" : "text-muted-foreground"
            )}
          />
          <span className={cn(
            "text-[11px] font-medium",
            liked ? "text-score-ruby" : "text-muted-foreground"
          )}>
            ถูกใจ
          </span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={() => navigate(`/store/${post.storeId}/order`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary transition-colors"
        >
          <MessageCircle size={16} className="text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground">ดูร้าน</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.85 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary transition-colors ml-auto"
        >
          <Share2 size={16} className="text-muted-foreground" />
        </motion.button>
      </div>
    </motion.div>
  );
};

/* ─── Score Pill ─── */
const ScorePill = ({ score }: { score: number }) => {
  const tier = getScoreTier(score);
  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl",
      tierBg[tier]
    )}>
      <span className={cn("text-lg font-bold tabular-nums", tierColors[tier])}>
        {score > 0 ? "+" : ""}{score}
      </span>
      <span className={cn("text-xs font-medium", tierColors[tier])}>
        {scoreLabel(score)}
      </span>
    </div>
  );
};

export default HomeFeed;
