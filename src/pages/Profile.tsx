import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Gem, Store, LogIn, Pencil, Check, X, Camera, Users, ChefHat, Grid3X3, Bookmark, Heart, MessageCircle } from "lucide-react";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* ── Types ── */
interface UserPost {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  store_id: string | null;
  likeCount: number;
  commentCount: number;
  images: string[]; // all carousel images
}

interface SavedStoreItem {
  id: string;
  storeId: string;
  storeName: string;
  savedAt: string;
}

/* ── Main Page ── */
const Profile = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string | null; email: string | null; avatar_url: string | null } | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Stats
  const [postCount, setPostCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Tabs
  const [activeTab, setActiveTab] = useState<"posts" | "saved">("posts");

  // Posts grid
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Saved stores
  const [savedStores, setSavedStores] = useState<SavedStoreItem[]>([]);

  const handleSaveName = async () => {
    if (!user || !nameInput.trim()) return;
    setSavingName(true);
    const { error } = await supabase.from("profiles").update({ display_name: nameInput.trim() } as any).eq("id", user.id);
    if (!error) setProfile((p) => p ? { ...p, display_name: nameInput.trim() } : p);
    setSavingName(false);
    setEditingName(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) return;
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
    if (uploadErr) { setUploadingAvatar(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from("profiles").update({ avatar_url: avatarUrl } as any).eq("id", user.id);
    setProfile((p) => p ? { ...p, avatar_url: avatarUrl } : p);
    setUploadingAvatar(false);
  };

  // Load profile, stats
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [profRes, followersRes, followingRes, postsCountRes] = await Promise.all([
        supabase.from("profiles").select("display_name, email, avatar_url" as any).eq("id", user.id).single(),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", user.id),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", user.id),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("hidden", false),
      ]);
      if (profRes.data) setProfile(profRes.data as any);
      setFollowerCount(followersRes.count || 0);
      setFollowingCount(followingRes.count || 0);
      setPostCount(postsCountRes.count || 0);

      // Saved stores
      const { data: savedData } = await supabase
        .from("saved_stores")
        .select("id, store_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (savedData && savedData.length > 0) {
        const savedStoreIds = savedData.map((s) => s.store_id);
        const { data: storesData } = await supabase.from("stores").select("id, name").in("id", savedStoreIds);
        const nameMap = new Map((storesData || []).map((s) => [s.id, s.name]));
        setSavedStores(savedData.map((s) => ({
          id: s.id,
          storeId: s.store_id,
          storeName: nameMap.get(s.store_id) || "ร้านค้า",
          savedAt: s.created_at,
        })));
      }
    };
    load();
  }, [user]);

  // Load posts
  useEffect(() => {
    if (!user) return;
    const loadPosts = async () => {
      setLoadingPosts(true);
      const { data: rawPosts } = await supabase
        .from("posts")
        .select("id, image_url, caption, created_at, store_id")
        .eq("user_id", user.id)
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .limit(60);

      if (!rawPosts || rawPosts.length === 0) { setPosts([]); setLoadingPosts(false); return; }

      const postIds = rawPosts.map((p) => p.id);

      // Get likes, comments, carousel images in parallel
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
      (imagesRes.data || []).forEach((img) => {
        if (!imagesMap.has(img.post_id)) imagesMap.set(img.post_id, []);
        imagesMap.get(img.post_id)!.push(img.image_url);
      });

      const enriched: UserPost[] = rawPosts.map((p) => ({
        id: p.id,
        image_url: p.image_url,
        caption: p.caption,
        created_at: p.created_at,
        store_id: p.store_id,
        likeCount: likesMap.get(p.id) || 0,
        commentCount: commentsMap.get(p.id) || 0,
        images: imagesMap.get(p.id) || [p.image_url],
      }));

      setPosts(enriched);
      setLoadingPosts(false);
    };
    loadPosts();
  }, [user]);

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-score-emerald border-t-transparent rounded-full animate-spin" />
        </div>
      </PageTransition>
    );
  }

  if (!user) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background pb-24">
          <div className="flex flex-col items-center justify-center h-[70vh] gap-4 px-6">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center" style={{ boxShadow: "0 0 0 3px hsl(163,78%,20%), 0 0 20px hsla(163,78%,20%,0.3)" }}>
              <Crown size={28} strokeWidth={1.5} className="text-score-emerald" />
            </div>
            <h1 className="text-xl font-medium text-foreground">Sovereign Profile</h1>
            <p className="text-sm text-muted-foreground text-center">เข้าสู่ระบบเพื่อดูโปรไฟล์ของคุณ</p>
            <button onClick={() => navigate("/auth")} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-foreground text-background text-sm font-medium mt-2">
              <LogIn size={16} /> เข้าสู่ระบบ
            </button>
          </div>
          <BottomNav />
        </div>
      </PageTransition>
    );
  }

  const displayName = profile?.display_name || profile?.email?.split("@")[0] || "Sovereign";

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        {/* ── IG-style Header ── */}
        <div className="px-5 pt-safe-top">
          {/* Top bar with username */}
          <div className="flex items-center justify-between py-3">
            <h1 className="text-lg font-bold text-foreground">{displayName}</h1>
            <button
              onClick={signOut}
              className="text-xs text-muted-foreground px-3 py-1.5 rounded-lg border border-border"
            >
              ออกจากระบบ
            </button>
          </div>

          {/* Profile row: avatar + stats */}
          <div className="flex items-center gap-5 pb-4">
            {/* Avatar */}
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative flex-shrink-0">
              <label className="cursor-pointer block">
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                <div
                  className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center overflow-hidden"
                  style={{ boxShadow: "0 0 0 3px hsl(163,78%,20%), 0 0 24px hsla(163,78%,20%,0.35)" }}
                >
                  {uploadingAvatar ? (
                    <div className="w-6 h-6 border-2 border-score-emerald border-t-transparent rounded-full animate-spin" />
                  ) : profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Crown size={32} strokeWidth={1.5} className="text-score-emerald" />
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-score-emerald flex items-center justify-center border-2 border-background">
                  <Camera size={10} className="text-white" />
                </div>
              </label>
            </motion.div>

            {/* Stats */}
            <div className="flex-1 flex justify-around">
              {[
                { value: postCount, label: "โพสต์", link: null },
                { value: followerCount, label: "ผู้ติดตาม", link: "/follows?tab=followers" },
                { value: followingCount, label: "ติดตาม", link: "/follows?tab=following" },
              ].map(({ value, label, link }) => (
                <button
                  key={label}
                  onClick={() => link && navigate(link)}
                  className="flex flex-col items-center"
                >
                  <span className="text-lg font-bold text-foreground">{value}</span>
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name + edit */}
          <div className="pb-3">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                  className="text-sm font-semibold text-foreground bg-transparent border-b-2 border-score-emerald outline-none w-40 pb-0.5"
                  maxLength={30}
                />
                <button onClick={handleSaveName} disabled={savingName} className="w-6 h-6 rounded-full bg-score-emerald/10 flex items-center justify-center">
                  <Check size={12} className="text-score-emerald" />
                </button>
                <button onClick={() => setEditingName(false)} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <X size={12} className="text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">{displayName}</span>
                <button
                  onClick={() => { setNameInput(profile?.display_name || ""); setEditingName(true); }}
                  className="w-5 h-5 rounded-full bg-muted flex items-center justify-center"
                >
                  <Pencil size={9} className="text-muted-foreground" />
                </button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">{profile?.email}</p>
          </div>

          {/* Founding Sovereign Badge */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4"
            style={{
              background: "linear-gradient(135deg, hsl(43,74%,49%), hsl(43,74%,65%))",
              boxShadow: "0 2px 12px hsla(43,74%,49%,0.3)",
            }}
          >
            <Crown size={11} className="text-white" />
            <span className="text-[10px] font-semibold text-white tracking-wide">Founding Sovereign · ×20</span>
          </motion.div>
        </div>

        {/* ── Tab Bar (Grid / Saved) ── */}
        <div className="flex border-t border-border">
          <button
            onClick={() => setActiveTab("posts")}
            className={cn(
              "flex-1 flex items-center justify-center py-3 transition-colors border-b-2",
              activeTab === "posts"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground"
            )}
          >
            <Grid3X3 size={20} strokeWidth={activeTab === "posts" ? 2 : 1.5} />
          </button>
          <button
            onClick={() => setActiveTab("saved")}
            className={cn(
              "flex-1 flex items-center justify-center py-3 transition-colors border-b-2",
              activeTab === "saved"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground"
            )}
          >
            <Bookmark size={20} strokeWidth={activeTab === "saved" ? 2 : 1.5} />
          </button>
        </div>

        {/* ── Content ── */}
        {activeTab === "posts" && (
          <div>
            {loadingPosts ? (
              <div className="grid grid-cols-3 gap-[1px]">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-secondary animate-pulse" />
                ))}
              </div>
            ) : posts.length > 0 ? (
              <div className="grid grid-cols-3 gap-[1px]">
                {posts.map((post) => (
                  <motion.button
                    key={post.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative aspect-square bg-secondary overflow-hidden group"
                    onClick={() => navigate(`/`)} // navigate to feed/post detail later
                  >
                    <img
                      src={post.images[0] || post.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />

                    {/* Carousel indicator */}
                    {post.images.length > 1 && (
                      <div className="absolute top-2 right-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="drop-shadow-md">
                          <rect x="3" y="3" width="14" height="14" rx="2" />
                          <path d="M7 21h14a2 2 0 0 0 2-2V7" />
                        </svg>
                      </div>
                    )}

                    {/* Hover overlay with likes/comments */}
                    <div className="absolute inset-0 bg-foreground/40 opacity-0 group-active:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <div className="flex items-center gap-1">
                        <Heart size={16} fill="white" className="text-white" />
                        <span className="text-white text-sm font-bold">{post.likeCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle size={16} fill="white" className="text-white" />
                        <span className="text-white text-sm font-bold">{post.commentCount}</span>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-6">
                <div className="w-16 h-16 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
                  <Camera size={28} strokeWidth={1.5} className="text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-1">แชร์รูปอาหาร</h3>
                <p className="text-sm text-muted-foreground text-center">เมื่อคุณโพสรูป จะแสดงในโปรไฟล์ของคุณ</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "saved" && (
          <div className="px-4 pt-4">
            {savedStores.length > 0 ? (
              <div className="space-y-2">
                {savedStores.map((s, i) => (
                  <motion.button
                    key={s.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => navigate(`/store/${s.storeId}/order`)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card shadow-luxury border border-border/30 text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="w-11 h-11 rounded-xl bg-score-emerald/10 flex items-center justify-center shrink-0">
                      <Store size={18} className="text-score-emerald" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground block truncate">{s.storeName}</span>
                      <span className="text-[10px] text-muted-foreground">บันทึกเมื่อ {new Date(s.savedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-6">
                <div className="w-16 h-16 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
                  <Bookmark size={28} strokeWidth={1.5} className="text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-1">บันทึกร้าน</h3>
                <p className="text-sm text-muted-foreground text-center">กดปุ่มบันทึกในฟีดเพื่อเก็บร้านที่ชอบ</p>
              </div>
            )}
          </div>
        )}

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default Profile;
