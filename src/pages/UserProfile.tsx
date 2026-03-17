import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, MessageCircle, UserPlus, UserCheck, Grid3X3, Trophy, Images } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import PageTransition from "@/components/PageTransition";
import PostDetailSheet from "@/components/PostDetailSheet";
import AchievementDetailSheet from "@/components/AchievementDetailSheet";

/* ── Types ── */
interface UserPost {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  store_id: string | null;
  likeCount: number;
  commentCount: number;
  images: string[];
}

interface TasteDNA {
  salty: number; sweet: number; sour: number; spicy: number; umami: number;
}

interface AchievementCtx {
  emeraldCount: number; storeCount: number; totalReviews: number; tasteDNA: TasteDNA; dnaEntryCount: number;
}

interface Achievement {
  id: string; icon: string; titleTh: string; description: string;
  check: (ctx: AchievementCtx) => boolean; tier: "emerald" | "gold" | "ruby";
}

const ACHIEVEMENTS: Achievement[] = [
  { id: "first-emerald", icon: "💎", titleTh: "เพชรดวงแรก", description: "ให้คะแนน +2 ครั้งแรก", check: (c) => c.emeraldCount >= 1, tier: "emerald" },
  { id: "emerald-5", icon: "💎", titleTh: "นักสะสมเพชร", description: "สะสม Emerald 5 ดวง", check: (c) => c.emeraldCount >= 5, tier: "emerald" },
  { id: "emerald-20", icon: "👑", titleTh: "มงกุฎเพชร", description: "สะสม Emerald 20 ดวง", check: (c) => c.emeraldCount >= 20, tier: "gold" },
  { id: "store-1", icon: "🏪", titleTh: "ก้าวแรก", description: "รีวิวร้านแรก", check: (c) => c.storeCount >= 1, tier: "emerald" },
  { id: "store-10", icon: "🗺️", titleTh: "นักสำรวจ", description: "เยือน 10 ร้าน", check: (c) => c.storeCount >= 10, tier: "gold" },
  { id: "store-30", icon: "🌍", titleTh: "ผู้พิชิตโลกรส", description: "เยือน 30 ร้าน", check: (c) => c.storeCount >= 30, tier: "ruby" },
  { id: "reviews-10", icon: "📝", titleTh: "นักวิจารณ์", description: "รีวิว 10 เมนู", check: (c) => c.totalReviews >= 10, tier: "emerald" },
  { id: "reviews-50", icon: "🔥", titleTh: "จอมวิจารณ์", description: "รีวิว 50 เมนู", check: (c) => c.totalReviews >= 50, tier: "gold" },
  { id: "spice-lord", icon: "🌶️", titleTh: "ราชาความเผ็ด", description: "Taste DNA เผ็ดสูงสุด", check: (c) => c.tasteDNA.spicy >= 4, tier: "ruby" },
  { id: "sweet-tooth", icon: "🍯", titleTh: "คนรักหวาน", description: "Taste DNA หวานสูงสุด", check: (c) => c.tasteDNA.sweet >= 4, tier: "gold" },
  { id: "umami-sage", icon: "🍄", titleTh: "ปราชญ์อูมามิ", description: "Taste DNA อูมามิสูงสุด", check: (c) => c.tasteDNA.umami >= 4, tier: "emerald" },
  { id: "dna-explorer", icon: "🧬", titleTh: "นักวิเคราะห์ DNA", description: "ส่ง Dish DNA 5 ครั้ง", check: (c) => c.dnaEntryCount >= 5, tier: "emerald" },
];

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const isMe = me?.id === userId;

  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  // Stats
  const [postCount, setPostCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Achievement data
  const [emeraldCount, setEmeraldCount] = useState(0);
  const [storeCount, setStoreCount] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [dnaEntryCount, setDnaEntryCount] = useState(0);
  const [tasteDNA, setTasteDNA] = useState<TasteDNA>({ salty: 0, sweet: 0, sour: 0, spicy: 0, umami: 0 });

  // Tabs & posts
  const [activeTab, setActiveTab] = useState<"posts" | "badges">("posts");
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Sheets
  const [selectedPost, setSelectedPost] = useState<UserPost | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<Achievement | null>(null);

  /* ── Load profile & stats ── */
  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    const load = async () => {
      const [profRes, { count: posts }, { count: followers }, { count: following },
        { count: emeralds }, storeReviews, { count: reviews }, { count: dna }] = await Promise.all([
        supabase.from("profiles").select("display_name, avatar_url").eq("id", userId).single(),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("hidden", false),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
        supabase.from("menu_reviews").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("score", 2),
        supabase.from("menu_reviews").select("menu_item_id, menu_items(store_id)").eq("user_id", userId),
        supabase.from("menu_reviews").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("dish_dna").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);

      setProfile(profRes.data);
      setPostCount(posts || 0);
      setFollowerCount(followers || 0);
      setFollowingCount(following || 0);
      setEmeraldCount(emeralds || 0);
      setTotalReviews(reviews || 0);
      setDnaEntryCount(dna || 0);

      const uniqueStores = new Set<string>();
      ((storeReviews as any).data || []).forEach((r: any) => {
        if (r.menu_items?.store_id) uniqueStores.add(r.menu_items.store_id);
      });
      setStoreCount(uniqueStores.size);

      // Taste DNA
      const { data: satData } = await supabase
        .from("satisfaction_ratings")
        .select("taste, cleanliness, texture, value, overall")
        .eq("user_id", userId);
      if (satData && satData.length > 0) {
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        setTasteDNA({
          salty: avg(satData.map((s) => s.overall)),
          sweet: avg(satData.map((s) => s.taste)),
          sour: avg(satData.map((s) => s.texture)),
          spicy: avg(satData.map((s) => s.value)),
          umami: avg(satData.map((s) => s.cleanliness)),
        });
      }

      // Follow status
      if (me && me.id !== userId) {
        const { data } = await supabase.from("follows").select("id").eq("follower_id", me.id).eq("following_id", userId).maybeSingle();
        setIsFollowing(!!data);
      }

      setLoading(false);
    };
    load();
  }, [userId, me]);

  /* ── Load posts grid ── */
  useEffect(() => {
    if (!userId) return;
    setLoadingPosts(true);

    const loadPosts = async () => {
      const { data: rawPosts } = await supabase
        .from("posts")
        .select("id, image_url, caption, created_at, store_id")
        .eq("user_id", userId).eq("hidden", false)
        .order("created_at", { ascending: false }).limit(60);

      if (!rawPosts || rawPosts.length === 0) { setPosts([]); setLoadingPosts(false); return; }

      const postIds = rawPosts.map((p) => p.id);
      const [likesRes, commentsRes, imagesRes] = await Promise.all([
        supabase.from("post_likes").select("ref_id").in("ref_id", postIds),
        supabase.from("feed_comments").select("ref_id").in("ref_id", postIds),
        supabase.from("post_images").select("post_id, image_url, sort_order").in("post_id", postIds).order("sort_order", { ascending: true }),
      ]);

      const likesMap = new Map<string, number>();
      (likesRes.data || []).forEach((l) => likesMap.set(l.ref_id, (likesMap.get(l.ref_id) || 0) + 1));
      const commentsMap = new Map<string, number>();
      (commentsRes.data || []).forEach((c) => commentsMap.set(c.ref_id, (commentsMap.get(c.ref_id) || 0) + 1));
      const imagesMap = new Map<string, string[]>();
      (imagesRes.data || []).forEach((i) => {
        if (!imagesMap.has(i.post_id)) imagesMap.set(i.post_id, []);
        imagesMap.get(i.post_id)!.push(i.image_url);
      });

      setPosts(rawPosts.map((p) => ({
        ...p, likeCount: likesMap.get(p.id) || 0, commentCount: commentsMap.get(p.id) || 0,
        images: imagesMap.get(p.id) || [p.image_url],
      })));
      setLoadingPosts(false);
    };
    loadPosts();
  }, [userId]);

  /* ── Follow toggle ── */
  const toggleFollow = async () => {
    if (!me || !userId || isMe) return;
    const was = isFollowing;
    setIsFollowing(!was);
    setFollowerCount((c) => c + (was ? -1 : 1));
    navigator.vibrate?.(8);
    if (was) {
      await supabase.from("follows").delete().eq("follower_id", me.id).eq("following_id", userId);
    } else {
      await supabase.from("follows").insert({ follower_id: me.id, following_id: userId });
    }
  };

  /* ── Achievement context ── */
  const achievementCtx: AchievementCtx = { emeraldCount, storeCount, totalReviews, tasteDNA, dnaEntryCount };
  const unlockedBadges = ACHIEVEMENTS.filter((a) => a.check(achievementCtx));
  const lockedBadges = ACHIEVEMENTS.filter((a) => !a.check(achievementCtx));

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
          <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-full bg-secondary text-sm">กลับ</button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        {/* Header bar */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/30">
          <div className="flex items-center gap-3 px-4 py-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
              <ArrowLeft size={16} className="text-foreground" />
            </motion.button>
            <h1 className="text-base font-semibold text-foreground truncate">{profile.display_name || "ผู้ใช้"}</h1>
          </div>
        </div>

        {/* IG-style profile header */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-secondary overflow-hidden ring-2 ring-border/20 flex-shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                  {(profile.display_name || "?").charAt(0)}
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="flex-1 grid grid-cols-3 text-center">
              {[
                { label: "โพส", value: postCount },
                { label: "ผู้ติดตาม", value: followerCount, action: () => navigate(`/follows?userId=${userId}&tab=followers`) },
                { label: "กำลังติดตาม", value: followingCount, action: () => navigate(`/follows?userId=${userId}&tab=following`) },
              ].map(({ label, value, action }) => (
                <button key={label} onClick={action} className="flex flex-col items-center">
                  <span className="text-lg font-bold text-foreground">{value}</span>
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <p className="text-sm font-semibold text-foreground mt-3">{profile.display_name || "ผู้ใช้"}</p>

          {/* Follow / Edit button */}
          {me && !isMe ? (
            <motion.button whileTap={{ scale: 0.95 }} onClick={toggleFollow}
              className={cn(
                "w-full mt-3 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all",
                isFollowing ? "bg-secondary text-foreground" : "bg-foreground text-background"
              )}>
              {isFollowing ? <><UserCheck size={15} /> ติดตามแล้ว</> : <><UserPlus size={15} /> ติดตาม</>}
            </motion.button>
          ) : isMe ? (
            <button onClick={() => navigate("/profile")}
              className="w-full mt-3 py-2 rounded-xl text-sm font-semibold bg-secondary text-foreground">
              แก้ไขโปรไฟล์
            </button>
          ) : null}
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-border">
          {[
            { key: "posts" as const, icon: Grid3X3 },
            { key: "badges" as const, icon: Trophy },
          ].map(({ key, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={cn(
                "flex-1 flex justify-center py-3 transition-all border-b-2",
                activeTab === key ? "border-foreground" : "border-transparent"
              )}>
              <Icon size={20} className={activeTab === key ? "text-foreground" : "text-muted-foreground"} />
            </button>
          ))}
        </div>

        {/* Posts Grid Tab */}
        {activeTab === "posts" && (
          <div>
            {loadingPosts ? (
              <div className="grid grid-cols-3 gap-[1px]">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-muted animate-pulse" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Grid3X3 size={40} strokeWidth={1} className="mb-3 opacity-30" />
                <p className="text-sm">ยังไม่มีโพส</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-[1px]">
                {posts.map((post) => (
                  <motion.button key={post.id} onClick={() => setSelectedPost(post)}
                    className="relative aspect-square group overflow-hidden bg-secondary">
                    <img src={post.images[0] || post.image_url} alt="" className="w-full h-full object-cover" />
                    {post.images.length > 1 && (
                      <div className="absolute top-1.5 right-1.5">
                        <Images size={14} className="text-white drop-shadow-lg" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-foreground/40 opacity-0 group-active:opacity-100 flex items-center justify-center gap-4 transition-opacity">
                      <div className="flex items-center gap-1 text-white text-xs font-semibold">
                        <Heart size={14} fill="white" /> {post.likeCount}
                      </div>
                      <div className="flex items-center gap-1 text-white text-xs font-semibold">
                        <MessageCircle size={14} fill="white" /> {post.commentCount}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Badges Tab */}
        {activeTab === "badges" && (
          <div className="px-4 pt-4 pb-8">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              🏆 Achievements <span className="text-[10px] text-muted-foreground font-normal">{unlockedBadges.length}/{ACHIEVEMENTS.length}</span>
            </h2>

            {unlockedBadges.length > 0 && (
              <div className="grid grid-cols-4 gap-2.5 mb-3">
                {unlockedBadges.map((badge, i) => {
                  const tc = {
                    emerald: "shadow-[0_0_0_1.5px_hsl(163,78%,20%),0_0_12px_hsla(163,78%,20%,0.2)]",
                    gold: "shadow-[0_0_0_1.5px_hsl(43,74%,49%),0_0_12px_hsla(43,74%,49%,0.2)]",
                    ruby: "shadow-[0_0_0_1.5px_hsl(0,68%,35%),0_0_12px_hsla(0,68%,35%,0.2)]",
                  }[badge.tier];
                  return (
                    <motion.button key={badge.id} initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1 + i * 0.06, type: "spring", stiffness: 400, damping: 20 }}
                      onClick={() => setSelectedBadge(badge)}
                      className={`flex flex-col items-center py-3 rounded-2xl bg-card ${tc} active:scale-95 transition-transform`}>
                      <span className="text-xl mb-1">{badge.icon}</span>
                      <span className="text-[9px] font-semibold text-foreground text-center leading-tight px-1">{badge.titleTh}</span>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {lockedBadges.length > 0 && (
              <div className="grid grid-cols-4 gap-2.5">
                {lockedBadges.map((badge) => (
                  <button key={badge.id} onClick={() => setSelectedBadge(badge)}
                    className="flex flex-col items-center py-3 rounded-2xl bg-muted/50 opacity-40 active:scale-95 transition-transform">
                    <span className="text-xl mb-1 grayscale">🔒</span>
                    <span className="text-[9px] font-medium text-muted-foreground text-center leading-tight px-1">{badge.titleTh}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Post Detail Sheet */}
        <PostDetailSheet
          open={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          postId={selectedPost?.id || ""}
          preload={selectedPost ? {
            imageUrl: selectedPost.image_url,
            images: selectedPost.images,
            caption: selectedPost.caption,
            likeCount: selectedPost.likeCount,
            commentCount: selectedPost.commentCount,
          } : undefined}
        />

        {/* Achievement Detail Sheet */}
        <AchievementDetailSheet
          open={!!selectedBadge}
          onClose={() => setSelectedBadge(null)}
          badge={selectedBadge}
          ctx={achievementCtx}
        />
      </div>
    </PageTransition>
  );
};

export default UserProfile;
