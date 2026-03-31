import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, Sparkles, Clock, ChefHat, RefreshCw, Send, Trash2, UserPlus, UserCheck, Bookmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/language-context";
import { getScoreTier, type ScoreTier } from "@/lib/categories";
import { cn } from "@/lib/utils";
import PageTransition from "@/components/PageTransition";
import TastureHeader from "@/components/TastureHeader";
import BottomNav from "@/components/BottomNav";
import HomeFeedTabs, { type FeedTab } from "@/components/HomeFeedTabs";
import { useGeolocation, haversineKm } from "@/hooks/use-geolocation";
import { Skeleton } from "@/components/ui/skeleton";
import FeedRadarChart, { type SatisfactionAxes } from "@/components/FeedRadarChart";
import SuggestedUsers from "@/components/SuggestedUsers";
/* ─── Types ─── */
interface PostImageSlide {
  imageUrl: string;
  reviewScore: number | null;
  menuItemName: string | null;
  storeName: string | null;
  storeId: string | null;
  dnaComponents?: { name: string; icon: string; tag: string; score: number }[];
  satisfaction?: SatisfactionAxes | null;
}

interface FeedPost {
  id: string;
  type: "combined" | "menu_review" | "dish_dna" | "photo_post";
  userId: string;
  userName: string;
  userAvatar: string | null;
  storeName: string;
  storeId: string;
  menuItemName: string;
  menuItemId: string;
  menuItemImage: string | null;
  score: number | null;
  satisfaction: SatisfactionAxes | null;
  dnaComponents?: { name: string; icon: string; tag: string; score: number }[];
  caption?: string | null;
  photoUrl?: string | null;
  slides?: PostImageSlide[];
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

const makeTimeAgo = (t: (key: string, params?: Record<string, string | number>) => string) => (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("feed.justNow");
  if (mins < 60) return t("feed.minsAgo", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("feed.hrsAgo", { n: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 7) return t("feed.daysAgo", { n: days });
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
};

const HomeFeed = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const timeAgo = useMemo(() => makeTimeAgo(t), [t]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<FeedTab>("explore");
  const [slideDirection, setSlideDirection] = useState(0);
  const prevTabIndexRef = useRef(0);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [storeLocations, setStoreLocations] = useState<Map<string, { lat: number; lng: number }>>(new Map());
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [batchSocial, setBatchSocial] = useState<{
    likeCountMap: Map<string, number>;
    commentCountMap: Map<string, number>;
    userLikedSet: Set<string>;
    userFollowingSet: Set<string>;
    userSavedSet: Set<string>;
  }>({ likeCountMap: new Map(), commentCountMap: new Map(), userLikedSet: new Set(), userFollowingSet: new Set(), userSavedSet: new Set() });
  const pageSize = useRef(30);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const knownPostIds = useRef<Set<string>>(new Set());
  const { position: geoPos } = useGeolocation();

  const PULL_THRESHOLD = 80;

  // Scroll shadow detection
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 10);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const refreshFollowingIds = useCallback(() => {
    if (!user) return;
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .then(({ data }) => {
        setFollowingIds(new Set((data || []).map((d) => d.following_id)));
      });
  }, [user]);

  useEffect(() => {
    refreshFollowingIds();
  }, [refreshFollowingIds]);

  useEffect(() => {
    fetchFeed();
  }, []);

  // Realtime subscription for new reviews and DNA
  useEffect(() => {
    const channel = supabase
      .channel("feed-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "menu_reviews" },
        () => fetchFeed(true, true)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dish_dna" },
        () => fetchFeed(true, true)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "satisfaction_ratings" },
        () => fetchFeed(true, true)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        () => fetchFeed(true, true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const fetchFeed = async (isRefresh = false, isRealtime = false, limit = 30) => {
    if (!isRefresh) setLoading(true);
    try {
      // Fetch recent menu reviews, dish DNA, satisfaction ratings, and store reviews in parallel
      const [reviewsRes, dnaRes, satRes, storeReviewsRes, photoPostsRes] = await Promise.all([
        supabase
          .from("menu_reviews")
          .select("id, score, user_id, menu_item_id, created_at")
          .eq("shared", true)
          .eq("hidden", false)
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("dish_dna")
          .select("id, user_id, menu_item_id, component_name, component_icon, selected_tag, selected_score, created_at")
          .order("created_at", { ascending: false })
          .limit(limit * 3),
        supabase
          .from("satisfaction_ratings")
          .select("user_id, menu_item_id, texture, taste, overall, cleanliness, value, created_at")
          .order("created_at", { ascending: false })
          .limit(limit * 2),
        supabase
          .from("reviews")
          .select("user_id, store_id, metric_id, score, created_at")
          .order("created_at", { ascending: false })
          .limit(limit * 3),
        supabase
          .from("posts")
          .select("id, user_id, image_url, caption, store_id, created_at")
          .eq("hidden", false)
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);

      // Collect unique user_ids and menu_item_ids
      const userIds = new Set<string>();
      const menuItemIds = new Set<string>();

      (reviewsRes.data || []).forEach((r) => { userIds.add(r.user_id); menuItemIds.add(r.menu_item_id); });
      (dnaRes.data || []).forEach((d) => { userIds.add(d.user_id); menuItemIds.add(d.menu_item_id); });
      (photoPostsRes.data || []).forEach((p) => { userIds.add(p.user_id); });

      // Fetch profiles, menu items, stores
      const [profilesRes, menuItemsRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_url, banned").in("id", [...userIds]),
        supabase.from("menu_items").select("id, name, store_id, image_url").in("id", [...menuItemIds]),
      ]);

      const bannedUsers = new Set<string>();
      const profileMap = new Map<string, { name: string; avatar: string | null }>();
      (profilesRes.data || []).forEach((p: any) => {
        if (p.banned) bannedUsers.add(p.id);
        profileMap.set(p.id, { name: p.display_name || t("feed.user"), avatar: p.avatar_url });
      });

      const menuMap = new Map<string, { name: string; storeId: string; image: string | null }>();
      const storeIds = new Set<string>();
      (menuItemsRes.data || []).forEach((m) => {
        menuMap.set(m.id, { name: m.name, storeId: m.store_id, image: m.image_url });
        storeIds.add(m.store_id);
      });
      // Also collect store_ids from photo posts
      (photoPostsRes.data || []).forEach((pp) => {
        if (pp.store_id) storeIds.add(pp.store_id);
      });

      const { data: storesData } = await supabase.from("stores").select("id, name, pin_lat, pin_lng").in("id", [...storeIds]);
      const storeMap = new Map<string, string>();
      const locMap = new Map<string, { lat: number; lng: number }>();
      (storesData || []).forEach((s) => {
        storeMap.set(s.id, s.name);
        if (s.pin_lat != null && s.pin_lng != null) locMap.set(s.id, { lat: s.pin_lat, lng: s.pin_lng });
      });
      setStoreLocations(locMap);

      // Group everything by user+menu_item to create combined posts
      const postMap = new Map<string, {
        userId: string;
        menuItemId: string;
        score: number | null;
        reviewId: string | null;
        satisfaction: SatisfactionAxes | null;
        dnaComponents: { name: string; icon: string; tag: string; score: number }[];
        latestTime: string;
      }>();

      // Helper: normalize store review score (-2..+2) to 1-5 scale
      const norm = (score: number) => Math.round(((score + 2) / 4) * 4 + 1);
      // Helper: normalize menu review score (-2, 0, +2) to 1-5
      const normMenu = (score: number) => score === 2 ? 5 : score === 0 ? 3 : 1;

      // Build store review lookup: user+store → mapped axes
      // metric_id mapping: table-clean→cleanliness, ambiance→overall
      const METRIC_TO_AXIS: Record<string, keyof SatisfactionAxes> = {
        "table-clean": "cleanliness",
        "ambiance": "overall",
      };
      const storeRevLookup = new Map<string, Partial<SatisfactionAxes>>();
      (storeReviewsRes.data || []).forEach((sr) => {
        const axis = METRIC_TO_AXIS[sr.metric_id];
        if (!axis) return;
        const key = `${sr.user_id}-${sr.store_id}`;
        if (!storeRevLookup.has(key)) storeRevLookup.set(key, {});
        const entry = storeRevLookup.get(key)!;
        if (entry[axis] == null) entry[axis] = norm(sr.score);
      });

      // Build satisfaction lookup from satisfaction_ratings table
      const satLookup = new Map<string, SatisfactionAxes>();
      (satRes.data || []).forEach((s) => {
        const key = `${s.user_id}-${s.menu_item_id}`;
        if (!satLookup.has(key)) {
          satLookup.set(key, { texture: s.texture, taste: s.taste, overall: s.overall, cleanliness: s.cleanliness });
        }
      });

      // Build Dish DNA → texture lookup: average selected_score per user+menuItem, normalize -2..+2 to 1-5
      const dnaTextureLookup = new Map<string, number>();
      const dnaAccum = new Map<string, { total: number; count: number }>();
      (dnaRes.data || []).forEach((d) => {
        const key = `${d.user_id}-${d.menu_item_id}`;
        if (!dnaAccum.has(key)) dnaAccum.set(key, { total: 0, count: 0 });
        const acc = dnaAccum.get(key)!;
        acc.total += d.selected_score;
        acc.count++;
      });
      dnaAccum.forEach((acc, key) => {
        dnaTextureLookup.set(key, norm(acc.total / acc.count));
      });

      // Merge function: combine satisfaction_ratings + store reviews + menu score + DNA texture
      const buildSatisfaction = (userId: string, menuItemId: string, menuScore: number | null, storeId: string | null): SatisfactionAxes | null => {
        const satKey = `${userId}-${menuItemId}`;
        const sat = satLookup.get(satKey);
        const storeKey = storeId ? `${userId}-${storeId}` : null;
        const storeRev = storeKey ? storeRevLookup.get(storeKey) : null;

        const merged: SatisfactionAxes = {};

        // Layer 1: satisfaction_ratings (highest priority, direct data)
        if (sat) Object.assign(merged, sat);

        // Layer 2: store reviews fill missing axes
        if (storeRev) {
          for (const [k, v] of Object.entries(storeRev)) {
            if (merged[k as keyof SatisfactionAxes] == null) {
              (merged as any)[k] = v;
            }
          }
        }

        // Layer 3: menu review score → taste (if missing)
        if (menuScore != null && merged.taste == null) {
          merged.taste = normMenu(menuScore);
        }

        // Layer 4: Dish DNA average → texture (if missing)
        const dnaTexture = dnaTextureLookup.get(satKey);
        if (dnaTexture != null && merged.texture == null) {
          merged.texture = dnaTexture;
        }

        return Object.keys(merged).length > 0 ? merged : null;
      };

      // Add reviews (satisfaction computed later when storeId known)
      (reviewsRes.data || []).forEach((r) => {
        const key = `${r.user_id}-${r.menu_item_id}`;
        if (!postMap.has(key)) {
          postMap.set(key, { userId: r.user_id, menuItemId: r.menu_item_id, score: null, reviewId: null, satisfaction: null, dnaComponents: [], latestTime: r.created_at });
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
          postMap.set(key, { userId: d.user_id, menuItemId: d.menu_item_id, score: null, reviewId: null, satisfaction: null, dnaComponents: [], latestTime: d.created_at });
        }
        const entry = postMap.get(key)!;
        entry.dnaComponents.push({ name: d.component_name, icon: d.component_icon, tag: d.selected_tag, score: d.selected_score });
        if (new Date(d.created_at) > new Date(entry.latestTime)) entry.latestTime = d.created_at;
      });

      // Build combined posts with merged satisfaction data
      const allPosts: FeedPost[] = [...postMap.entries()].map(([key, entry]) => {
        const profile = profileMap.get(entry.userId);
        const menu = menuMap.get(entry.menuItemId);
        const storeId = menu?.storeId || null;
        const hasReview = entry.score != null;
        const hasDna = entry.dnaComponents.length > 0;
        const type = hasReview && hasDna ? "combined" : hasReview ? "menu_review" : "dish_dna";

        // Merge all data sources for satisfaction chart
        const satisfaction = buildSatisfaction(entry.userId, entry.menuItemId, entry.score, storeId);

        return {
          id: `post-${key}`,
          type,
          userId: entry.userId,
          userName: profile?.name || t("feed.user"),
          userAvatar: profile?.avatar || null,
          storeName: menu ? (storeMap.get(menu.storeId) || t("feed.store")) : t("feed.store"),
          storeId: storeId || "",
          menuItemName: menu?.name || "เมนู",
          menuItemId: entry.menuItemId,
          menuItemImage: menu?.image || null,
          score: entry.score,
          satisfaction,
          dnaComponents: hasDna ? entry.dnaComponents : undefined,
          createdAt: entry.latestTime,
        } as FeedPost;
      });

      // Add photo posts from posts table with carousel slides
      const photoPostIds = (photoPostsRes.data || []).map((pp) => pp.id);
      let postImagesMap = new Map<string, { image_url: string; menu_review_id: string | null; sort_order: number }[]>();

      if (photoPostIds.length > 0) {
        const { data: piData } = await supabase
          .from("post_images")
          .select("post_id, image_url, menu_review_id, sort_order")
          .in("post_id", photoPostIds)
          .order("sort_order", { ascending: true });

        (piData || []).forEach((pi: any) => {
          if (!postImagesMap.has(pi.post_id)) postImagesMap.set(pi.post_id, []);
          postImagesMap.get(pi.post_id)!.push(pi);
        });

        // Fetch linked review details for slides
        const slideReviewIds = (piData || [])
          .filter((pi: any) => pi.menu_review_id)
          .map((pi: any) => pi.menu_review_id);

        let slideReviewMap = new Map<string, { score: number; menu_item_id: string }>();
        if (slideReviewIds.length > 0) {
          const { data: srData } = await supabase
            .from("menu_reviews")
            .select("id, score, menu_item_id")
            .in("id", slideReviewIds);
          (srData || []).forEach((sr) => slideReviewMap.set(sr.id, { score: sr.score, menu_item_id: sr.menu_item_id }));
        }

        // Collect menu_item_ids and user_ids from slides for DNA + satisfaction fetch
        const slideMenuItemIds = new Set<string>();
        const slideUserIds = new Set<string>();
        slideReviewMap.forEach((sr) => slideMenuItemIds.add(sr.menu_item_id));
        (photoPostsRes.data || []).forEach((pp) => slideUserIds.add(pp.user_id));

        // Fetch dish_dna and satisfaction_ratings for slide-linked items
        let slideDnaMap = new Map<string, { name: string; icon: string; tag: string; score: number }[]>();
        let slideSatMap = new Map<string, SatisfactionAxes>();

        if (slideMenuItemIds.size > 0) {
          const [slideDnaRes, slideSatRes] = await Promise.all([
            supabase
              .from("dish_dna")
              .select("user_id, menu_item_id, component_name, component_icon, selected_tag, selected_score")
              .in("menu_item_id", [...slideMenuItemIds]),
            supabase
              .from("satisfaction_ratings")
              .select("user_id, menu_item_id, texture, taste, overall, cleanliness, value")
              .in("menu_item_id", [...slideMenuItemIds]),
          ]);

          (slideDnaRes.data || []).forEach((d) => {
            const key = `${d.user_id}-${d.menu_item_id}`;
            if (!slideDnaMap.has(key)) slideDnaMap.set(key, []);
            slideDnaMap.get(key)!.push({
              name: d.component_name,
              icon: d.component_icon,
              tag: d.selected_tag,
              score: d.selected_score,
            });
          });

          (slideSatRes.data || []).forEach((s) => {
            const key = `${s.user_id}-${s.menu_item_id}`;
            const axes: SatisfactionAxes = {};
            if (s.taste != null) axes.taste = s.taste;
            if (s.texture != null) axes.texture = s.texture;
            if (s.overall != null) axes.overall = s.overall;
            if (s.cleanliness != null) axes.cleanliness = s.cleanliness;
            if (Object.keys(axes).length > 0) slideSatMap.set(key, axes);
          });
        }

        // Build slides for each photo post
        (photoPostsRes.data || []).forEach((pp) => {
          const profile = profileMap.get(pp.user_id);
          const ppStoreId = pp.store_id || "";
          const piList = postImagesMap.get(pp.id) || [];

          const slides: PostImageSlide[] = piList.length > 0
            ? piList.map((pi) => {
                const review = pi.menu_review_id ? slideReviewMap.get(pi.menu_review_id) : null;
                const menuItem = review ? menuMap.get(review.menu_item_id) : null;
                const slideKey = review ? `${pp.user_id}-${review.menu_item_id}` : null;
                return {
                  imageUrl: pi.image_url,
                  reviewScore: review?.score ?? null,
                  menuItemName: menuItem?.name || (review ? t("feed.menu") : null),
                  storeName: menuItem?.storeId ? (storeMap.get(menuItem.storeId) || null) : null,
                  storeId: menuItem?.storeId || null,
                  dnaComponents: slideKey ? slideDnaMap.get(slideKey) : undefined,
                  satisfaction: slideKey ? slideSatMap.get(slideKey) : undefined,
                };
              })
            : [{ imageUrl: pp.image_url, reviewScore: null, menuItemName: null, storeName: null, storeId: null }];

          allPosts.push({
            id: `photo-${pp.id}`,
            type: "photo_post",
            userId: pp.user_id,
            userName: profile?.name || t("feed.user"),
            userAvatar: profile?.avatar || null,
            storeName: ppStoreId ? (storeMap.get(ppStoreId) || t("feed.store")) : "",
            storeId: ppStoreId,
            menuItemName: "",
            menuItemId: "",
            menuItemImage: null,
            score: null,
            satisfaction: null,
            caption: pp.caption,
            photoUrl: pp.image_url,
            slides,
            createdAt: pp.created_at,
          });
        });
      } else {
        (photoPostsRes.data || []).forEach((pp) => {
          const profile = profileMap.get(pp.user_id);
          const ppStoreId = pp.store_id || "";
          allPosts.push({
            id: `photo-${pp.id}`, type: "photo_post",
            userId: pp.user_id, userName: profile?.name || t("feed.user"), userAvatar: profile?.avatar || null,
            storeName: ppStoreId ? (storeMap.get(ppStoreId) || t("feed.store")) : "", storeId: ppStoreId,
            menuItemName: "", menuItemId: "", menuItemImage: null, score: null, satisfaction: null,
            caption: pp.caption, photoUrl: pp.image_url,
            slides: [{ imageUrl: pp.image_url, reviewScore: null, menuItemName: null, storeName: null, storeId: null }],
            createdAt: pp.created_at,
          });
        });
      }

      allPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      // Filter out banned users
      const visiblePosts = allPosts.filter((p) => !bannedUsers.has(p.userId));
      const finalPosts = visiblePosts.slice(0, limit);
      setHasMore(visiblePosts.length > limit);
      pageSize.current = limit;

      // === BATCH fetch all per-post social data in parallel ===
      const allRefIds = finalPosts.map((p) =>
        p.type === "photo_post" ? p.id.replace("photo-", "") : `${p.userId}-${p.menuItemId}`
      );
      const allPostUserIds = [...new Set(finalPosts.map((p) => p.userId))];
      const allStoreIdsForSave = [...new Set(finalPosts.map((p) => p.storeId).filter(Boolean))];

      const batchPromises: Promise<any>[] = [
        Promise.resolve(supabase.from("post_likes").select("ref_id").in("ref_id", allRefIds)),
        Promise.resolve(supabase.from("feed_comments").select("ref_id").in("ref_id", allRefIds)),
      ];
      if (user) {
        batchPromises.push(
          Promise.resolve(supabase.from("post_likes").select("ref_id").eq("user_id", user.id).in("ref_id", allRefIds))
        );
        batchPromises.push(
          Promise.resolve(supabase.from("follows").select("following_id").eq("follower_id", user.id).in("following_id", allPostUserIds))
        );
        batchPromises.push(
          allStoreIdsForSave.length > 0
            ? Promise.resolve(supabase.from("saved_stores").select("store_id").eq("user_id", user.id).in("store_id", allStoreIdsForSave))
            : Promise.resolve({ data: [] })
        );
      }

      const batchResults = await Promise.all(batchPromises);

      // Build lookup maps
      const likeCountMap = new Map<string, number>();
      (batchResults[0].data || []).forEach((r: any) => {
        likeCountMap.set(r.ref_id, (likeCountMap.get(r.ref_id) || 0) + 1);
      });
      const commentCountMap = new Map<string, number>();
      (batchResults[1].data || []).forEach((r: any) => {
        commentCountMap.set(r.ref_id, (commentCountMap.get(r.ref_id) || 0) + 1);
      });

      const userLikedSet = new Set<string>();
      const userFollowingSet = new Set<string>();
      const userSavedSet = new Set<string>();
      if (user) {
        (batchResults[2]?.data || []).forEach((r: any) => userLikedSet.add(r.ref_id));
        (batchResults[3]?.data || []).forEach((r: any) => userFollowingSet.add(r.following_id));
        (batchResults[4]?.data || []).forEach((r: any) => userSavedSet.add(r.store_id));
      }

      setBatchSocial({ likeCountMap, commentCountMap, userLikedSet, userFollowingSet, userSavedSet });

      // Track new posts from realtime
      if (isRealtime) {
        const freshIds = new Set<string>();
        finalPosts.forEach((p) => {
          if (!knownPostIds.current.has(p.id)) freshIds.add(p.id);
        });
        if (freshIds.size > 0) {
          setNewPostIds(freshIds);
          navigator.vibrate?.(8);
          setTimeout(() => setNewPostIds(new Set()), 3000);
        }
      }

      // Update known IDs
      finalPosts.forEach((p) => knownPostIds.current.add(p.id));
      setPosts(finalPosts);
    } catch (err) {
      console.error("Feed fetch error:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchFeed(true, false, pageSize.current + 20);
  }, [loadingMore, hasMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && !loadingMore && hasMore) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMore, loadMore]);

  const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);

  // Filter posts based on active tab
  const filteredPosts = useMemo(() => {
    switch (activeTab) {
      case "following":
        return posts.filter((p) => followingIds.has(p.userId));
      case "nearby": {
        if (!geoPos) return posts; // fallback to all if no location
        const NEARBY_KM = 10;
        return posts.filter((p) => {
          const loc = storeLocations.get(p.storeId);
          if (!loc) return false;
          return haversineKm(geoPos.lat, geoPos.lng, loc.lat, loc.lng) <= NEARBY_KM;
        });
      }
      case "foryou":
        // Show posts from users the current user follows + own posts, prioritized
        if (!user) return posts;
        return posts.filter((p) => followingIds.has(p.userId) || p.userId === user.id);
      case "explore":
      default:
        return posts;
    }
  }, [posts, activeTab, followingIds, geoPos, storeLocations, user]);

  const tabIndexMap: Record<FeedTab, number> = { explore: 0, nearby: 1, following: 2, foryou: 3 };
  const tabOrder: FeedTab[] = ["explore", "nearby", "following", "foryou"];
  const handleTabChange = useCallback((tab: FeedTab) => {
    const newIndex = tabIndexMap[tab];
    const dir = newIndex > prevTabIndexRef.current ? 1 : -1;
    setSlideDirection(dir);
    prevTabIndexRef.current = newIndex;
    setActiveTab(tab);
  }, []);

  const handleSwipe = useCallback((direction: "left" | "right") => {
    const currentIndex = tabIndexMap[activeTab];
    const nextIndex = direction === "left" ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex >= 0 && nextIndex < tabOrder.length) {
      handleTabChange(tabOrder[nextIndex]);
      if (navigator.vibrate) navigator.vibrate(8);
    }
  }, [activeTab, handleTabChange]);

  const emptyMessages: Record<FeedTab, string> = {
    explore: t("feed.emptyExplore"),
    nearby: geoPos ? t("feed.emptyNearby") : t("feed.emptyNearbyNoGeo"),
    following: t("feed.emptyFollowing"),
    foryou: t("feed.emptyForyou"),
  };

  return (
    <PageTransition>
      <div className="h-screen flex flex-col bg-background">
        {/* Fixed Header */}
        <div className="flex-shrink-0 z-40 bg-background transition-shadow duration-300" style={scrolled ? { boxShadow: '0 4px 12px -2px hsla(163, 78%, 20%, 0.12)' } : undefined}>
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
              <span className="ml-2 text-[11px] font-medium text-score-emerald">{t("feed.releaseRefresh")}</span>
            )}
            {refreshing && (
              <span className="ml-2 text-[11px] font-medium text-muted-foreground">{t("feed.refreshing")}</span>
            )}
          </motion.div>
        </div>

        {/* Fixed Title + Tabs */}
        <div className="flex-shrink-0 z-30 bg-background border-b border-border/50 transition-shadow duration-300" style={scrolled ? { boxShadow: '0 2px 8px -1px hsla(163, 78%, 20%, 0.08)' } : undefined}>
          <HomeFeedTabs active={activeTab} onChange={handleTabChange} />
        </div>

        {/* Scrollable Content */}
        <div ref={containerRef} className="flex-1 overflow-y-auto pb-24 overflow-x-hidden">
          <AnimatePresence mode="wait" custom={slideDirection}>
            <motion.div
              key={activeTab}
              custom={slideDirection}
              initial={{ x: slideDirection * 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: slideDirection * 60, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_e, info) => {
                if (Math.abs(info.offset.x) > 50) {
                  handleSwipe(info.offset.x < 0 ? "left" : "right");
                }
              }}
            >
          {/* Suggested Users for "foryou" tab */}
          {activeTab === "foryou" && user && !loading && (
            <div className="px-4 pt-2">
              <SuggestedUsers userId={user.id} followingIds={followingIds} onFollowChange={refreshFollowingIds} />
            </div>
          )}

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
            ) : filteredPosts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center py-16 gap-3"
              >
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                  <ChefHat size={28} className="text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">{emptyMessages[activeTab]}</p>
                {activeTab === "explore" && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => navigate("/store-list")}
                    className="mt-2 px-5 py-2.5 rounded-full bg-foreground text-background text-xs font-medium"
                  >
                    {t("feed.exploreStores")}
                  </motion.button>
                )}
                {activeTab === "following" && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => navigate("/discover")}
                    className="mt-2 px-5 py-2.5 rounded-full bg-foreground text-background text-xs font-medium"
                  >
                    {t("feed.findPeople")}
                  </motion.button>
                )}
              </motion.div>
            ) : (
              <AnimatePresence>
                {filteredPosts.map((post, i) => (
                  <PostCard key={post.id} post={post} index={i} navigate={navigate} user={user} isNew={newPostIds.has(post.id)}
                    initialLikeCount={batchSocial.likeCountMap.get(post.type === "photo_post" ? post.id.replace("photo-", "") : `${post.userId}-${post.menuItemId}`) || 0}
                    initialLiked={batchSocial.userLikedSet.has(post.type === "photo_post" ? post.id.replace("photo-", "") : `${post.userId}-${post.menuItemId}`)}
                    initialCommentCount={batchSocial.commentCountMap.get(post.type === "photo_post" ? post.id.replace("photo-", "") : `${post.userId}-${post.menuItemId}`) || 0}
                    initialFollowing={batchSocial.userFollowingSet.has(post.userId)}
                    initialSaved={batchSocial.userSavedSet.has(post.storeId)}
                  />
                ))}
              </AnimatePresence>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-score-emerald border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!hasMore && filteredPosts.length > 0 && (
              <p className="text-center text-[11px] text-muted-foreground/50 py-4">{t("feed.noMorePosts")}</p>
            )}
          </div>
            </motion.div>
          </AnimatePresence>
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
  isNew?: boolean;
  initialLikeCount: number;
  initialLiked: boolean;
  initialCommentCount: number;
  initialFollowing: boolean;
  initialSaved: boolean;
}

const PostCard = ({ post, index, navigate, user, isNew, initialLikeCount, initialLiked, initialCommentCount, initialFollowing, initialSaved }: PostCardProps) => {
  const { t } = useLanguage();
  const timeAgo = useMemo(() => makeTimeAgo(t), [t]);
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followLoading, setFollowLoading] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; emoji: string; scale: number }[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [saved, setSaved] = useState(initialSaved);
  const [deleted, setDeleted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  // Derive refId for comments/likes
  const refType = "post";
  const refId = post.type === "photo_post" ? post.id.replace("photo-", "") : `${post.userId}-${post.menuItemId}`;

  // Like/comment counts are now provided via batch props — no per-card queries needed

  const burstParticles = () => {
    const emojis = ["❤️", "🧡", "💛", "💖", "✨", "💫", "🌟", "💕"];
    const burst = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 120,
      y: -(Math.random() * 80 + 30),
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      scale: 0.6 + Math.random() * 0.6,
    }));
    setParticles(burst);
    setTimeout(() => setParticles([]), 900);
  };

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      await supabase.from("post_likes").delete().eq("ref_id", refId).eq("user_id", user.id);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      navigator.vibrate?.(8);
      burstParticles();
      await supabase.from("post_likes").insert({ ref_id: refId, user_id: user.id });
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!liked && user) {
        setLiked(true);
        setLikeCount((c) => c + 1);
        navigator.vibrate?.(8);
        burstParticles();
        supabase.from("post_likes").insert({ ref_id: refId, user_id: user.id });
      }
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 900);
    }
    lastTapRef.current = now;
  };

  const toggleFollow = async () => {
    if (!user || user.id === post.userId) return;
    setFollowLoading(true);
    if (isFollowing) {
      setIsFollowing(false);
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", post.userId);
    } else {
      setIsFollowing(true);
      navigator.vibrate?.(8);
      await supabase.from("follows").insert({ follower_id: user.id, following_id: post.userId });
    }
    setFollowLoading(false);
  };

  // Follow and saved states are now provided via batch props — no per-card queries needed


  const toggleSaveStore = async () => {
    if (!user || !post.storeId) return;
    navigator.vibrate?.(8);
    if (saved) {
      await supabase.from("saved_stores").delete().eq("user_id", user.id).eq("store_id", post.storeId);
      setSaved(false);
    } else {
      await supabase.from("saved_stores").insert({ user_id: user.id, store_id: post.storeId } as any);
      setSaved(true);
    }
  };

  const handleDeletePost = async () => {
    if (!user || user.id !== post.userId) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    navigator.vibrate?.(8);
    if (post.type === "photo_post") {
      const realId = post.id.replace("photo-", "");
      await supabase.from("post_images").delete().eq("post_id", realId);
      await supabase.from("post_likes").delete().eq("ref_id", realId);
      await supabase.from("feed_comments").delete().eq("ref_id", realId);
      await supabase.from("posts").delete().eq("id", realId);
    } else {
      // Delete menu review, dish_dna, satisfaction for this user+menuItem
      await supabase.from("dish_dna").delete().eq("user_id", user.id).eq("menu_item_id", post.menuItemId);
      await supabase.from("satisfaction_ratings").delete().eq("user_id", user.id).eq("menu_item_id", post.menuItemId);
      await supabase.from("menu_reviews").delete().eq("user_id", user.id).eq("menu_item_id", post.menuItemId);
      await supabase.from("post_likes").delete().eq("ref_id", refId);
      await supabase.from("feed_comments").delete().eq("ref_id", refId);
    }
    setDeleted(true);
  };

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
      (profiles || []).forEach((p) => profileMap.set(p.id, { name: p.display_name || t("feed.user"), avatar: p.avatar_url }));

      setComments(data.map((c) => ({
        id: c.id,
        userId: c.user_id,
        userName: profileMap.get(c.user_id)?.name || t("feed.user"),
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
    if (navigator.vibrate) navigator.vibrate(8);
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
        userName: profile?.display_name || t("feed.user"),
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

  if (deleted) {
    return (
      <motion.div
        initial={{ opacity: 1, scale: 1, height: "auto", marginBottom: 12 }}
        animate={{
          opacity: 0,
          scale: 0.85,
          x: -120,
          height: 0,
          marginBottom: 0,
          filter: "blur(8px)",
        }}
        transition={{
          duration: 0.5,
          ease: [0.4, 0, 0.2, 1],
          height: { delay: 0.25, duration: 0.3 },
          marginBottom: { delay: 0.25, duration: 0.3 },
        }}
        className="overflow-hidden rounded-2xl"
      >
        <div className="flex items-center justify-center py-6 bg-destructive/5 border border-destructive/20 rounded-2xl">
          <motion.div
1120:             initial={{ scale: 0, rotate: -45 }}
1121:             animate={{ scale: 1, rotate: 0 }}
1122:             transition={{ type: "spring", stiffness: 500, damping: 25 }}
1123:             className="flex items-center gap-2 text-destructive"
1124:           >
1125:             <Trash2 size={18} />
1126:             <span className="text-sm font-semibold">{t("feed.deleted")}</span>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: -40, scale: 0.95 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={isNew
        ? { type: "spring", stiffness: 380, damping: 34, mass: 0.8 }
        : { delay: index * 0.05, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
      }
      className={cn(
        "rounded-2xl bg-surface-elevated border shadow-luxury overflow-hidden transition-all duration-700",
        isNew
          ? "border-score-emerald/50 ring-2 ring-score-emerald/20 shadow-[0_0_20px_hsl(var(--score-emerald)/0.15)]"
          : "border-border/50"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div
          onClick={() => navigate(`/user/${post.userId}`)}
          className="w-10 h-10 rounded-full bg-secondary overflow-hidden shrink-0 ring-2 ring-border/30 cursor-pointer active:scale-95 transition-transform"
        >
          {post.userAvatar ? (
            <img src={post.userAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm">
              {post.userName.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0" onClick={() => navigate(`/user/${post.userId}`)} role="button">
          <p className="text-sm font-semibold text-foreground truncate cursor-pointer">{post.userName}</p>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Clock size={10} />
            <span>{timeAgo(post.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {user && user.id !== post.userId && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleFollow}
              disabled={followLoading}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide transition-all",
                isFollowing
                  ? "bg-score-emerald/10 text-score-emerald"
                  : "bg-secondary text-muted-foreground hover:bg-accent"
              )}
            >
              {isFollowing ? <UserCheck size={10} /> : <UserPlus size={10} />}
              {isFollowing ? "ติดตามแล้ว" : "ติดตาม"}
            </motion.button>
          )}
          {(post.type === "combined" || post.type === "menu_review") && (
            <span className="px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide bg-score-amber/10 text-score-amber">
              ⭐ รีวิว
            </span>
          )}
          {(post.type === "combined" || post.type === "dish_dna") && (
            <span className="px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide bg-score-emerald/10 text-score-emerald">
              🧬 DNA
            </span>
          )}
          {post.type === "photo_post" && (
            <span className="px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide bg-primary/10 text-primary">
              📸 โพส
            </span>
          )}
        </div>
      </div>

      {/* Action text */}
      <div className="px-4 pb-2">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {post.type === "photo_post" ? (
            <>
              {post.caption ? (
                <span className="text-foreground">{post.caption}</span>
              ) : (
                "แชร์รูปอาหาร"
              )}
              {post.storeName && (
                <>
                  {" "}ที่{" "}
                  <button
                    onClick={() => navigate(`/store/${post.storeId}/order`)}
                    className="font-semibold text-score-emerald hover:underline"
                  >
                    {post.storeName}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              {post.type === "combined"
                ? "รีวิวและวิเคราะห์ DNA ของ"
                : post.type === "menu_review"
                ? "ให้คะแนน"
                : "วิเคราะห์ Dish DNA ของ"}{" "}
              <span className="font-semibold text-foreground">{post.menuItemName}</span>
              {" "}ที่{" "}
              <button
                onClick={() => navigate(`/store/${post.storeId}/order`)}
                className="font-semibold text-score-emerald hover:underline"
              >
                {post.storeName}
              </button>
            </>
          )}
        </p>
      </div>

      {/* Photo post carousel with double-tap to like */}
      {post.type === "photo_post" && post.slides && post.slides.length > 0 && (
        <div className="px-4 pb-3">
          <div className="relative rounded-xl overflow-hidden aspect-square select-none">
            {/* Swipeable carousel */}
            <div
              ref={carouselRef}
              className="relative w-full h-full"
              onClick={handleDoubleTap}
              onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                const dx = e.changedTouches[0].clientX - touchStartX.current;
                if (Math.abs(dx) > 50) {
                  if (dx < 0 && slideIndex < (post.slides?.length || 1) - 1) {
                    setSlideIndex((p) => p + 1);
                  } else if (dx > 0 && slideIndex > 0) {
                    setSlideIndex((p) => p - 1);
                  }
                }
              }}
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.img
                  key={slideIndex}
                  src={post.slides[slideIndex].imageUrl}
                  alt={post.slides[slideIndex].menuItemName || post.caption || "รูปอาหาร"}
                  className="absolute inset-0 w-full h-full object-cover"
                  initial={{ opacity: 0, x: 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -60 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  loading="lazy"
                  draggable={false}
                />
              </AnimatePresence>
            </div>

            {/* Slide counter */}
            {post.slides.length > 1 && (
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-[10px] font-bold text-white">
                {slideIndex + 1} / {post.slides.length}
              </div>
            )}

            {/* Dot indicators */}
            {post.slides.length > 1 && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                {post.slides.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all duration-200",
                      i === slideIndex ? "bg-white w-4" : "bg-white/50"
                    )}
                  />
                ))}
              </div>
            )}

            {/* Double-tap heart */}
            <AnimatePresence>
              {showHeartAnim && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.4, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <Heart size={72} className="fill-white text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.3)]" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Review data below image */}
          <AnimatePresence mode="wait">
            {(post.slides[slideIndex].reviewScore !== null || post.slides[slideIndex].dnaComponents?.length || post.slides[slideIndex].satisfaction) && (
              <motion.div
                key={`review-${slideIndex}`}
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -6, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2.5 space-y-2"
              >
                {/* Review score + menu name + store link */}
                {post.slides[slideIndex].reviewScore !== null && (
                  <div
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-xl bg-secondary border border-border/50",
                      post.slides[slideIndex].storeId && "cursor-pointer active:scale-[0.98] transition-transform"
                    )}
                    onClick={() => {
                      const sid = post.slides[slideIndex].storeId;
                      if (sid) navigate(`/store/${sid}/order`);
                    }}
                  >
                    <span className="text-xl">
                      {post.slides[slideIndex].reviewScore === 2 ? "🤩" : post.slides[slideIndex].reviewScore === 0 ? "😐" : "😔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-foreground truncate">
                        {post.slides[slideIndex].menuItemName}
                      </p>
                      {post.slides[slideIndex].storeName && (
                        <p className="text-[9px] text-muted-foreground truncate">
                          📍 {post.slides[slideIndex].storeName}
                        </p>
                      )}
                    </div>
                    {post.slides[slideIndex].storeId && (
                      <span className="text-muted-foreground text-xs">›</span>
                    )}
                  </div>
                )}

                {/* Dish DNA tags */}
                {post.slides[slideIndex].dnaComponents && post.slides[slideIndex].dnaComponents!.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {post.slides[slideIndex].dnaComponents!.slice(0, 6).map((dna, di) => (
                      <span
                        key={di}
                        className={cn(
                          "inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-semibold border",
                          dna.score === 2
                            ? "bg-score-emerald/15 border-score-emerald/30 text-score-emerald"
                            : dna.score === -2
                            ? "bg-score-ruby/15 border-score-ruby/30 text-score-ruby"
                            : "bg-secondary border-border/50 text-muted-foreground"
                        )}
                      >
                        {dna.icon} {dna.tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Sensory feedback radar chart */}
                {post.slides[slideIndex].satisfaction && (
                  <div className="flex justify-center">
                    <FeedRadarChart data={post.slides[slideIndex].satisfaction!} size={120} />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Menu item image */}
      {post.type !== "photo_post" && post.menuItemImage && (
        <div className="px-4 pb-3">
          <div
            className="relative rounded-xl overflow-hidden cursor-pointer aspect-[16/10] select-none"
            onClick={handleDoubleTap}
          >
            <img
              src={post.menuItemImage}
              alt={post.menuItemName}
              className="w-full h-full object-cover"
              loading="lazy"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3">
              <span className="text-xs font-semibold text-white drop-shadow-md">
                {post.menuItemName}
              </span>
            </div>
            <AnimatePresence>
              {showHeartAnim && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.4, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <Heart size={72} className="fill-white text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.3)]" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Satisfaction Radar Chart */}
      {post.satisfaction && (
        <div className="flex justify-center px-4 pb-3">
          <FeedRadarChart data={post.satisfaction} size={180} />
        </div>
      )}

      {/* DNA Components */}
      {(post.type === "dish_dna" || post.type === "combined") && post.dnaComponents && post.dnaComponents.length > 0 && (
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
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={toggleLike}
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
              {likeCount > 0 ? likeCount : "ถูกใจ"}
            </span>
          </motion.button>
          <AnimatePresence>
            {particles.map((p) => (
              <motion.span
                key={p.id}
                initial={{ opacity: 1, x: 0, y: 0, scale: 0 }}
                animate={{ opacity: 0, x: p.x, y: p.y, scale: p.scale }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="absolute left-3 top-0 pointer-events-none text-sm"
              >
                {p.emoji}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>

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

        {post.storeId && user && (
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={toggleSaveStore}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary transition-colors"
          >
            <Bookmark
              size={16}
              className={cn(
                "transition-all duration-200",
                saved ? "fill-score-emerald text-score-emerald" : "text-muted-foreground"
              )}
            />
            <span className={cn(
              "text-[11px] font-medium",
              saved ? "text-score-emerald" : "text-muted-foreground"
            )}>
              {saved ? "บันทึกแล้ว" : "บันทึก"}
            </span>
          </motion.button>
        )}

        <motion.button
          whileTap={{ scale: 0.85 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-secondary transition-colors ml-auto"
        >
          <Share2 size={16} className="text-muted-foreground" />
        </motion.button>

        {user && user.id === post.userId && (
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleDeletePost}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors",
              confirmDelete
                ? "bg-destructive/10 text-destructive"
                : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            )}
          >
            <Trash2 size={16} />
            <span className="text-[11px] font-medium">
              {confirmDelete ? "กดอีกครั้ง" : "ลบ"}
            </span>
          </motion.button>
        )}
      </div>

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

export default HomeFeed;
