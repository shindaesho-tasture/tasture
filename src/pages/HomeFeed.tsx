import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, Sparkles, Clock, ChefHat, RefreshCw, Send, Trash2 } from "lucide-react";
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
  type: "combined" | "menu_review" | "dish_dna";
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

      // Group everything by user+menu_item to create combined posts
      const postMap = new Map<string, {
        userId: string;
        menuItemId: string;
        score: number | null;
        reviewId: string | null;
        dnaComponents: { name: string; icon: string; tag: string; score: number }[];
        latestTime: string;
      }>();

      // Add reviews
      (reviewsRes.data || []).forEach((r) => {
        const key = `${r.user_id}-${r.menu_item_id}`;
        if (!postMap.has(key)) {
          postMap.set(key, { userId: r.user_id, menuItemId: r.menu_item_id, score: null, reviewId: null, dnaComponents: [], latestTime: r.created_at });
        }
        const entry = postMap.get(key)!;
        entry.score = r.score;
        entry.reviewId = r.id;
        if (new Date(r.created_at) > new Date(entry.latestTime)) entry.latestTime = r.created_at;
      });

      // Add DNA
      (dnaRes.data || []).forEach((d) => {
        const key = `${d.user_id}-${d.menu_item_id}`;
        if (!postMap.has(key)) {
          postMap.set(key, { userId: d.user_id, menuItemId: d.menu_item_id, score: null, reviewId: null, dnaComponents: [], latestTime: d.created_at });
        }
        const entry = postMap.get(key)!;
        entry.dnaComponents.push({ name: d.component_name, icon: d.component_icon, tag: d.selected_tag, score: d.selected_score });
        if (new Date(d.created_at) > new Date(entry.latestTime)) entry.latestTime = d.created_at;
      });

      // Build combined posts
      const allPosts: FeedPost[] = [...postMap.entries()].map(([key, entry]) => {
        const profile = profileMap.get(entry.userId);
        const menu = menuMap.get(entry.menuItemId);
        const hasReview = entry.score != null;
        const hasDna = entry.dnaComponents.length > 0;
        const type = hasReview && hasDna ? "combined" : hasReview ? "menu_review" : "dish_dna";

        return {
          id: `post-${key}`,
          type,
          userId: entry.userId,
          userName: profile?.name || "ผู้ใช้",
          userAvatar: profile?.avatar || null,
          storeName: menu ? (storeMap.get(menu.storeId) || "ร้านค้า") : "ร้านค้า",
          storeId: menu?.storeId || "",
          menuItemName: menu?.name || "เมนู",
          menuItemId: entry.menuItemId,
          menuItemImage: menu?.image || null,
          score: entry.score,
          dnaComponents: hasDna ? entry.dnaComponents : undefined,
          createdAt: entry.latestTime,
        };
      });

      allPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
                <PostCard key={post.id} post={post} index={i} navigate={navigate} user={user} />
              ))}
            </AnimatePresence>
          )}
        </div>

        <BottomNav />
      </div>
    </PageTransition>
  );
};

/* ─── Comment Type ─── */
interface FeedComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  createdAt: string;
}

/* ─── Post Card Component ─── */
interface PostCardProps {
  post: FeedPost;
  index: number;
  navigate: ReturnType<typeof useNavigate>;
  user: any;
}

const PostCard = ({ post, index, navigate, user }: PostCardProps) => {
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive refId from post
  const refType = post.type;
  const refId = post.type === "menu_review"
    ? post.id.replace("review-", "")
    : post.id.replace("dna-", "");

  // Fetch comment count on mount
  useEffect(() => {
    supabase
      .from("feed_comments")
      .select("id", { count: "exact", head: true })
      .eq("ref_type", refType)
      .eq("ref_id", refId)
      .then(({ count }) => setCommentCount(count || 0));
  }, [refType, refId]);

  const fetchComments = async () => {
    setLoadingComments(true);
    const { data } = await supabase
      .from("feed_comments")
      .select("id, user_id, content, created_at")
      .eq("ref_type", refType)
      .eq("ref_id", refId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map<string, { name: string; avatar: string | null }>();
      (profiles || []).forEach((p) => profileMap.set(p.id, { name: p.display_name || "ผู้ใช้", avatar: p.avatar_url }));

      setComments(data.map((c) => ({
        id: c.id,
        userId: c.user_id,
        userName: profileMap.get(c.user_id)?.name || "ผู้ใช้",
        userAvatar: profileMap.get(c.user_id)?.avatar || null,
        content: c.content,
        createdAt: c.created_at,
      })));
    } else {
      setComments([]);
    }
    setLoadingComments(false);
  };

  const toggleComments = () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) fetchComments();
    if (next) setTimeout(() => inputRef.current?.focus(), 200);
  };

  const submitComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || !user || submitting) return;
    if (trimmed.length > 500) return;
    setSubmitting(true);

    const { data, error } = await supabase
      .from("feed_comments")
      .insert({ user_id: user.id, ref_type: refType, ref_id: refId, content: trimmed })
      .select("id, created_at")
      .single();

    if (!error && data) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .single();

      setComments((prev) => [...prev, {
        id: data.id,
        userId: user.id,
        userName: profile?.display_name || "ผู้ใช้",
        userAvatar: profile?.avatar_url || null,
        content: trimmed,
        createdAt: data.created_at,
      }]);
      setCommentCount((c) => c + 1);
      setCommentText("");
    }
    setSubmitting(false);
  };

  const deleteComment = async (commentId: string) => {
    await supabase.from("feed_comments").delete().eq("id", commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setCommentCount((c) => Math.max(0, c - 1));
  };

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
          onClick={toggleComments}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary transition-colors"
        >
          <MessageCircle
            size={16}
            className={cn(showComments ? "text-score-emerald" : "text-muted-foreground")}
          />
          <span className={cn(
            "text-[11px] font-medium",
            showComments ? "text-score-emerald" : "text-muted-foreground"
          )}>
            {commentCount > 0 ? commentCount : "คอมเมนต์"}
          </span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.85 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary transition-colors ml-auto"
        >
          <Share2 size={16} className="text-muted-foreground" />
        </motion.button>
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden border-t border-border/30"
          >
            <div className="px-4 py-3 space-y-3">
              {/* Comments list */}
              {loadingComments ? (
                <div className="flex justify-center py-3">
                  <div className="w-5 h-5 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-2">
                  ยังไม่มีคอมเมนต์ — เป็นคนแรก!
                </p>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto">
                  {comments.map((c) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-2.5 group"
                    >
                      <div className="w-7 h-7 rounded-full bg-secondary overflow-hidden shrink-0">
                        {c.userAvatar ? (
                          <img src={c.userAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px]">
                            {c.userName.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-secondary rounded-2xl rounded-tl-md px-3 py-2">
                          <p className="text-[11px] font-semibold text-foreground">{c.userName}</p>
                          <p className="text-[11px] text-foreground/80 leading-relaxed break-words">{c.content}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 px-1">
                          <span className="text-[9px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                          {user && c.userId === user.id && (
                            <button
                              onClick={() => deleteComment(c.id)}
                              className="text-[9px] text-muted-foreground hover:text-score-ruby transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Comment input */}
              {user ? (
                <div className="flex items-center gap-2 pt-1">
                  <div className="w-7 h-7 rounded-full bg-secondary shrink-0 overflow-hidden">
                    <div className="w-full h-full flex items-center justify-center text-[9px] text-muted-foreground">
                      ✍️
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-1.5 bg-secondary rounded-full px-3 py-1.5">
                    <input
                      ref={inputRef}
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value.slice(0, 500))}
                      onKeyDown={(e) => e.key === "Enter" && submitComment()}
                      placeholder="เขียนคอมเมนต์…"
                      className="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground outline-none"
                      maxLength={500}
                    />
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={submitComment}
                      disabled={!commentText.trim() || submitting}
                      className={cn(
                        "p-1 rounded-full transition-colors",
                        commentText.trim() ? "text-score-emerald" : "text-muted-foreground/40"
                      )}
                    >
                      <Send size={14} />
                    </motion.button>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground text-center">
                  เข้าสู่ระบบเพื่อคอมเมนต์
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
