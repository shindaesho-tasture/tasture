import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image, X, Send, MapPin, Loader2, Search, ChevronDown, Star, Clock, Plus, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";

interface StoreOption { id: string; name: string; }

interface RecentReview {
  id: string;
  menu_item_id: string;
  menu_item_name: string;
  store_name: string;
  store_id: string;
  score: number;
  created_at: string;
}

interface PostImage {
  file: File;
  preview: string;
  linkedReview: RecentReview | null;
}

const scoreEmoji = (s: number) => (s === 2 ? "🤩" : s === 0 ? "😐" : "😔");

const makeTimeAgoCp = (t: (key: string, params?: Record<string, string | number>) => string) => (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("feed.justNow");
  if (mins < 60) return t("feed.minsAgo", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("feed.hrsAgo", { n: hrs });
  const days = Math.floor(hrs / 24);
  return t("feed.daysAgo", { n: days });
};

const CreatePost = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const timeAgo = makeTimeAgoCp(t);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<PostImage[]>([]);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  // Store tag
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [loadingStores, setLoadingStores] = useState(false);

  // Review link
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [showReviewPicker, setShowReviewPicker] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);
  // Which image index the review picker is for
  const [reviewPickerTarget, setReviewPickerTarget] = useState(0);

  useEffect(() => {
    fetchStores();
    if (user) fetchRecentReviews();
  }, [user]);

  // Auto-link review from query param
  useEffect(() => {
    const reviewId = searchParams.get("review");
    if (reviewId && recentReviews.length > 0 && images.length === 0) {
      const found = recentReviews.find((r) => r.id === reviewId);
      if (found && found.store_id) {
        setSelectedStore({ id: found.store_id, name: found.store_name });
      }
    }
  }, [searchParams, recentReviews]);

  // When first image added + query param review, auto-link
  useEffect(() => {
    const reviewId = searchParams.get("review");
    if (reviewId && images.length === 1 && !images[0].linkedReview) {
      const found = recentReviews.find((r) => r.id === reviewId);
      if (found) {
        setImages((prev) => prev.map((img, i) => i === 0 ? { ...img, linkedReview: found } : img));
      }
    }
  }, [images.length, recentReviews, searchParams]);

  const fetchStores = async () => {
    setLoadingStores(true);
    const { data } = await supabase.from("stores").select("id, name").order("name");
    setStores(data || []);
    setLoadingStores(false);
  };

  const fetchRecentReviews = async () => {
    if (!user) return;
    setLoadingReviews(true);
    const { data } = await supabase
      .from("menu_reviews")
      .select("id, menu_item_id, score, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data && data.length > 0) {
      const menuIds = [...new Set(data.map((r) => r.menu_item_id))];
      const { data: menuItems } = await supabase
        .from("menu_items").select("id, name, store_id").in("id", menuIds);
      const menuMap = new Map((menuItems || []).map((m) => [m.id, { name: m.name, store_id: m.store_id }]));
      const storeIds = [...new Set((menuItems || []).map((m) => m.store_id))];
      const { data: storesData } = await supabase.from("stores").select("id, name").in("id", storeIds);
      const storeMap = new Map((storesData || []).map((s) => [s.id, s.name]));

      setRecentReviews(data.map((r) => {
        const menu = menuMap.get(r.menu_item_id);
        return {
          id: r.id, menu_item_id: r.menu_item_id,
          menu_item_name: menu?.name || t("feed.menu"),
          store_name: menu?.store_id ? (storeMap.get(menu.store_id) || t("feed.store")) : t("feed.store"),
          store_id: menu?.store_id || "", score: r.score, created_at: r.created_at,
        };
      }));
    }
    setLoadingReviews(false);
  };

  const filteredStores = storeSearch
    ? stores.filter((s) => s.name.toLowerCase().includes(storeSearch.toLowerCase()))
    : stores;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => f.size <= 10 * 1024 * 1024);
    if (valid.length < files.length) {
      toast({ title: t("createPost.fileTooLarge"), description: t("createPost.maxSize"), variant: "destructive" });
    }
    const newImages: PostImage[] = valid.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      linkedReview: null,
    }));
    setImages((prev) => {
      const merged = [...prev, ...newImages].slice(0, 10);
      return merged;
    });
    setActiveImageIdx(images.length); // go to first new image
    e.target.value = "";
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });
    setActiveImageIdx((prev) => Math.min(prev, Math.max(0, images.length - 2)));
  };

  const openReviewPicker = (imgIdx: number) => {
    setReviewPickerTarget(imgIdx);
    setShowReviewPicker(true);
  };

  const linkReviewToImage = (review: RecentReview) => {
    setImages((prev) =>
      prev.map((img, i) => i === reviewPickerTarget ? { ...img, linkedReview: review } : img)
    );
    setShowReviewPicker(false);
    // Auto-set store
    if (review.store_id && !selectedStore) {
      setSelectedStore({ id: review.store_id, name: review.store_name });
    }
  };

  const unlinkReview = (imgIdx: number) => {
    setImages((prev) =>
      prev.map((img, i) => i === imgIdx ? { ...img, linkedReview: null } : img)
    );
  };

  const handleSubmit = async () => {
    if (!user || images.length === 0 || uploading) return;
    setUploading(true);

    try {
      // Upload all images
      const uploaded: { url: string; reviewId: string | null; order: number }[] = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const ext = img.file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}-${i}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("post-images")
          .upload(path, img.file, { contentType: img.file.type });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
        uploaded.push({ url: urlData.publicUrl, reviewId: img.linkedReview?.id || null, order: i });
      }

      // Create the post with first image as cover
      const { data: postData, error: insertErr } = await supabase.from("posts").insert({
        user_id: user.id,
        image_url: uploaded[0].url,
        caption: caption.trim() || null,
        store_id: selectedStore?.id || null,
        menu_review_id: uploaded[0].reviewId,
      } as any).select("id").single();

      if (insertErr) throw insertErr;

      // Insert all images into post_images
      if (postData) {
        const rows = uploaded.map((u) => ({
          post_id: postData.id,
          image_url: u.url,
          menu_review_id: u.reviewId,
          sort_order: u.order,
        }));
        const { error: imgErr } = await supabase.from("post_images").insert(rows as any);
        if (imgErr) console.error("post_images insert error:", imgErr);
      }

      toast({ title: t("createPost.success") });
      navigate("/");
    } catch (err: any) {
      console.error(err);
      toast({ title: t("createPost.error"), description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 pb-24">
          <p className="text-muted-foreground text-sm">{t("createPost.loginRequired")}</p>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate("/auth")}
            className="px-6 py-2.5 rounded-full bg-foreground text-background text-sm font-semibold">
            {t("common.login")}
          </motion.button>
          <BottomNav />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/30">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-lg font-bold text-foreground">{t("createPost.title")}</h1>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={images.length === 0 || uploading}
              className={cn(
                "flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-all",
                images.length > 0 && !uploading
                  ? "bg-score-emerald text-white shadow-[0_2px_12px_hsl(163_78%_20%/0.3)]"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
              {uploading ? t("createPost.posting") : t("createPost.postBtn")}
            </motion.button>
          </div>
        </div>

        <div className="px-4 pt-4 space-y-4">
          {/* Image area */}
          {images.length > 0 ? (
            <div className="space-y-3">
              {/* Main preview */}
              <motion.div
                key={activeImageIdx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative rounded-2xl overflow-hidden shadow-luxury border border-border/30"
              >
                <img
                  src={images[activeImageIdx]?.preview}
                  alt="Preview"
                  className="w-full aspect-square object-cover"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => removeImage(activeImageIdx)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-luxury"
                >
                  <X size={16} className="text-foreground" />
                </motion.button>

                {/* Image counter */}
                {images.length > 1 && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-sm text-[10px] font-bold text-foreground">
                    {activeImageIdx + 1} / {images.length}
                  </div>
                )}

                {/* Linked review overlay */}
                {images[activeImageIdx]?.linkedReview && (
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="absolute bottom-3 left-3 right-3"
                  >
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background/85 backdrop-blur-md border border-border/30">
                      <span className="text-lg">{scoreEmoji(images[activeImageIdx].linkedReview!.score)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground truncate">
                          {images[activeImageIdx].linkedReview!.menu_item_name}
                        </p>
                        <p className="text-[9px] text-muted-foreground truncate">
                          {images[activeImageIdx].linkedReview!.store_name}
                        </p>
                      </div>
                      <button
                        onClick={() => unlinkReview(activeImageIdx)}
                        className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center"
                      >
                        <X size={10} className="text-muted-foreground" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>

              {/* Thumbnails + add more */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <motion.button
                    key={idx}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveImageIdx(idx)}
                    className={cn(
                      "relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all",
                      idx === activeImageIdx
                        ? "border-score-emerald shadow-[0_0_8px_hsl(163_78%_20%/0.3)]"
                        : "border-border/30 opacity-60"
                    )}
                  >
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    {img.linkedReview && (
                      <div className="absolute bottom-0 left-0 right-0 bg-background/80 text-center">
                        <span className="text-[9px]">{scoreEmoji(img.linkedReview.score)}</span>
                      </div>
                    )}
                  </motion.button>
                ))}
                {images.length < 10 && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 w-16 h-16 rounded-xl border-2 border-dashed border-border/50 flex items-center justify-center"
                  >
                    <Plus size={20} className="text-muted-foreground" />
                  </motion.button>
                )}
              </div>

              {/* Link review button for active image */}
              {!images[activeImageIdx]?.linkedReview && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openReviewPicker(activeImageIdx)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-score-amber/5 border border-score-amber/20 transition-all"
                >
                  <Star size={14} className="text-score-amber" />
                  <span className="text-xs text-muted-foreground">{t("createPost.attachReview")}</span>
                </motion.button>
              )}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border-2 border-dashed border-border/50 bg-card aspect-square flex flex-col items-center justify-center gap-6"
            >
              <div className="text-4xl">📸</div>
              <p className="text-sm text-muted-foreground font-medium">{t("createPost.shareYourFood")}</p>
              <p className="text-[10px] text-muted-foreground/60">{t("createPost.maxPhotos")}</p>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-semibold"
                >
                  <Camera size={16} /> {t("createPost.takePhoto")}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-foreground text-sm font-semibold"
                >
                  <Image size={16} /> {t("createPost.selectPhoto")}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Review Picker Modal */}
          <AnimatePresence>
            {showReviewPicker && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center"
                onClick={() => setShowReviewPicker(false)}
              >
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  className="w-full max-w-lg rounded-t-3xl bg-card border-t border-border/30 shadow-luxury overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-border" />
                  </div>
                  <div className="px-4 py-3 border-b border-border/20">
                    <h3 className="text-sm font-bold text-foreground">{t("createPost.selectReviewFor", { num: reviewPickerTarget + 1 })}</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t("createPost.yourReviews")}</p>
                  </div>
                  <div className="max-h-[50vh] overflow-y-auto">
                    {loadingReviews ? (
                      <div className="flex justify-center py-6">
                        <div className="w-6 h-6 border-2 border-score-amber border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : recentReviews.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-8">{t("createPost.noReviews")}</p>
                    ) : (
                      recentReviews.map((review) => {
                        const alreadyUsed = images.some((img, i) => i !== reviewPickerTarget && img.linkedReview?.id === review.id);
                        return (
                          <motion.button
                            key={review.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => !alreadyUsed && linkReviewToImage(review)}
                            disabled={alreadyUsed}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-border/10 last:border-b-0",
                              alreadyUsed ? "opacity-30" : "hover:bg-secondary/50 active:bg-secondary"
                            )}
                          >
                            <span className="text-xl shrink-0">{scoreEmoji(review.score)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{review.menu_item_name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <MapPin size={10} className="text-muted-foreground shrink-0" />
                                <span className="text-[10px] text-muted-foreground truncate">{review.store_name}</span>
                                <span className="text-[10px] text-muted-foreground/50">•</span>
                                <Clock size={9} className="text-muted-foreground/50 shrink-0" />
                                <span className="text-[10px] text-muted-foreground/50">{timeAgo(review.created_at)}</span>
                              </div>
                            </div>
                            {alreadyUsed && (
                              <span className="text-[9px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{t("createPost.alreadyUsed")}</span>
                            )}
                          </motion.button>
                        );
                      })
                    )}
                  </div>
                  <div className="p-4 border-t border-border/20">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setShowReviewPicker(false)}
                      className="w-full py-3 rounded-2xl bg-secondary text-sm font-medium text-muted-foreground"
                    >
                      {t("createPost.skipForNow")}
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Store Tag */}
          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowStorePicker(!showStorePicker)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all",
                selectedStore ? "bg-score-emerald/5 border-score-emerald/30" : "bg-card border-border/30 shadow-luxury"
              )}
            >
              <MapPin size={16} className={selectedStore ? "text-score-emerald" : "text-muted-foreground"} />
              <span className={cn("flex-1 text-left text-sm", selectedStore ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {selectedStore ? selectedStore.name : t("createPost.tagStore")}
              </span>
              {selectedStore ? (
                <motion.div whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setSelectedStore(null); }}
                  className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                  <X size={12} className="text-muted-foreground" />
                </motion.div>
              ) : (
                <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", showStorePicker && "rotate-180")} />
              )}
            </motion.button>

            <AnimatePresence>
              {showStorePicker && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="mt-2 rounded-2xl bg-card border border-border/30 shadow-luxury overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/20">
                    <Search size={14} className="text-muted-foreground shrink-0" />
                    <input type="text" value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)}
                      placeholder={t("createPost.searchStore")} autoFocus
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
                    {storeSearch && <button onClick={() => setStoreSearch("")}><X size={12} className="text-muted-foreground" /></button>}
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {loadingStores ? (
                      <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-score-emerald border-t-transparent rounded-full animate-spin" /></div>
                    ) : filteredStores.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-4">ไม่พบร้าน</p>
                    ) : filteredStores.map((store) => (
                      <motion.button key={store.id} whileTap={{ scale: 0.98 }}
                        onClick={() => { setSelectedStore(store); setShowStorePicker(false); setStoreSearch(""); }}
                        className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                          selectedStore?.id === store.id ? "bg-score-emerald/10" : "hover:bg-secondary/50")}>
                        <MapPin size={12} className="text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground truncate">{store.name}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Caption */}
          <div className="rounded-2xl bg-card border border-border/30 shadow-luxury overflow-hidden">
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)}
              placeholder="เขียนอะไรสักหน่อย... 🍜" maxLength={500} rows={3}
              className="w-full bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none" />
            <div className="px-4 pb-2 flex justify-end">
              <span className={cn("text-[10px] font-medium", caption.length > 450 ? "text-score-ruby" : "text-muted-foreground/40")}>
                {caption.length}/500
              </span>
            </div>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default CreatePost;
