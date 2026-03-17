import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image, X, Send, MapPin, Loader2, Search, ChevronDown, Star, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";

interface StoreOption {
  id: string;
  name: string;
}

interface RecentReview {
  id: string;
  menu_item_id: string;
  menu_item_name: string;
  store_name: string;
  store_id: string;
  score: number;
  created_at: string;
}

const scoreEmoji = (s: number) => (s === 2 ? "🤩" : s === 0 ? "😐" : "😔");

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  const days = Math.floor(hrs / 24);
  return `${days} วันที่แล้ว`;
};

const CreatePost = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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
  const [selectedReview, setSelectedReview] = useState<RecentReview | null>(null);
  const [showReviewPicker, setShowReviewPicker] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);

  useEffect(() => {
    fetchStores();
    if (user) fetchRecentReviews();
  }, [user]);

  // Auto-link review from query param (from MenuFeedback redirect)
  useEffect(() => {
    const reviewId = searchParams.get("review");
    if (reviewId && recentReviews.length > 0) {
      const found = recentReviews.find((r) => r.id === reviewId);
      if (found) {
        setSelectedReview(found);
        // Auto-select the store too
        if (found.store_id) {
          setSelectedStore({ id: found.store_id, name: found.store_name });
        }
      }
    }
  }, [searchParams, recentReviews]);

  const fetchStores = async () => {
    setLoadingStores(true);
    const { data } = await supabase
      .from("stores")
      .select("id, name")
      .order("name");
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
        .from("menu_items")
        .select("id, name, store_id")
        .in("id", menuIds);

      const menuMap = new Map(
        (menuItems || []).map((m) => [m.id, { name: m.name, store_id: m.store_id }])
      );

      const storeIds = [...new Set((menuItems || []).map((m) => m.store_id))];
      const { data: storesData } = await supabase
        .from("stores")
        .select("id, name")
        .in("id", storeIds);
      const storeMap = new Map((storesData || []).map((s) => [s.id, s.name]));

      setRecentReviews(
        data.map((r) => {
          const menu = menuMap.get(r.menu_item_id);
          return {
            id: r.id,
            menu_item_id: r.menu_item_id,
            menu_item_name: menu?.name || "เมนู",
            store_name: menu?.store_id ? (storeMap.get(menu.store_id) || "ร้านค้า") : "ร้านค้า",
            store_id: menu?.store_id || "",
            score: r.score,
            created_at: r.created_at,
          };
        })
      );
    }
    setLoadingReviews(false);
  };

  const filteredStores = storeSearch
    ? stores.filter((s) => s.name.toLowerCase().includes(storeSearch.toLowerCase()))
    : stores;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "ไฟล์ใหญ่เกินไป", description: "ขนาดไฟล์ต้องไม่เกิน 10MB", variant: "destructive" });
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const handleSubmit = async () => {
    if (!user || !imageFile || uploading) return;
    setUploading(true);

    try {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("post-images")
        .upload(path, imageFile, { contentType: imageFile.type });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);

      const { error: insertErr } = await supabase.from("posts").insert({
        user_id: user.id,
        image_url: urlData.publicUrl,
        caption: caption.trim() || null,
        store_id: selectedStore?.id || null,
        menu_review_id: selectedReview?.id || null,
      } as any);

      if (insertErr) throw insertErr;

      toast({ title: "โพสสำเร็จ! 🎉" });
      navigate("/");
    } catch (err: any) {
      console.error(err);
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 pb-24">
          <p className="text-muted-foreground text-sm">กรุณาเข้าสู่ระบบก่อนโพส</p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/auth")}
            className="px-6 py-2.5 rounded-full bg-foreground text-background text-sm font-semibold"
          >
            เข้าสู่ระบบ
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
            <h1 className="text-lg font-bold text-foreground">โพสใหม่</h1>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={!imageFile || uploading}
              className={cn(
                "flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-all",
                imageFile && !uploading
                  ? "bg-score-emerald text-white shadow-[0_2px_12px_hsl(163_78%_20%/0.3)]"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
              {uploading ? "กำลังโพส..." : "โพส"}
            </motion.button>
          </div>
        </div>

        <div className="px-4 pt-4 space-y-4">
          {/* Image area */}
          <AnimatePresence mode="wait">
            {imagePreview ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative rounded-2xl overflow-hidden shadow-luxury border border-border/30"
              >
                <img src={imagePreview} alt="Preview" className="w-full aspect-square object-cover" />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={clearImage}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-luxury"
                >
                  <X size={16} className="text-foreground" />
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border-2 border-dashed border-border/50 bg-card aspect-square flex flex-col items-center justify-center gap-6"
              >
                <div className="text-4xl">📸</div>
                <p className="text-sm text-muted-foreground font-medium">แชร์รูปอาหารของคุณ</p>
                <div className="flex gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-semibold"
                  >
                    <Camera size={16} />
                    ถ่ายรูป
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-foreground text-sm font-semibold"
                  >
                    <Image size={16} />
                    เลือกรูป
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Link Review */}
          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowReviewPicker(!showReviewPicker)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all",
                selectedReview
                  ? "bg-score-amber/5 border-score-amber/30"
                  : "bg-card border-border/30 shadow-luxury"
              )}
            >
              <Star size={16} className={selectedReview ? "text-score-amber" : "text-muted-foreground"} />
              <span className={cn(
                "flex-1 text-left text-sm truncate",
                selectedReview ? "font-semibold text-foreground" : "text-muted-foreground"
              )}>
                {selectedReview
                  ? `${scoreEmoji(selectedReview.score)} ${selectedReview.menu_item_name} — ${selectedReview.store_name}`
                  : "แนบรีวิวล่าสุด (ไม่บังคับ)"}
              </span>
              {selectedReview ? (
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); setSelectedReview(null); }}
                  className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center"
                >
                  <X size={12} className="text-muted-foreground" />
                </motion.div>
              ) : (
                <ChevronDown size={14} className={cn(
                  "text-muted-foreground transition-transform",
                  showReviewPicker && "rotate-180"
                )} />
              )}
            </motion.button>

            <AnimatePresence>
              {showReviewPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="mt-2 rounded-2xl bg-card border border-border/30 shadow-luxury overflow-hidden"
                >
                  <div className="px-4 py-2.5 border-b border-border/20">
                    <p className="text-[10px] font-medium text-muted-foreground tracking-wide">รีวิวล่าสุดของคุณ</p>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {loadingReviews ? (
                      <div className="flex justify-center py-4">
                        <div className="w-5 h-5 border-2 border-score-amber border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : recentReviews.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-4">ยังไม่มีรีวิว</p>
                    ) : (
                      recentReviews.map((review) => (
                        <motion.button
                          key={review.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedReview(review);
                            setShowReviewPicker(false);
                            // Auto-set store
                            if (review.store_id && !selectedStore) {
                              setSelectedStore({ id: review.store_id, name: review.store_name });
                            }
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/10 last:border-b-0",
                            selectedReview?.id === review.id
                              ? "bg-score-amber/10"
                              : "hover:bg-secondary/50"
                          )}
                        >
                          <span className="text-lg shrink-0">{scoreEmoji(review.score)}</span>
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
                        </motion.button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Store Tag */}
          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowStorePicker(!showStorePicker)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all",
                selectedStore
                  ? "bg-score-emerald/5 border-score-emerald/30"
                  : "bg-card border-border/30 shadow-luxury"
              )}
            >
              <MapPin size={16} className={selectedStore ? "text-score-emerald" : "text-muted-foreground"} />
              <span className={cn(
                "flex-1 text-left text-sm",
                selectedStore ? "font-semibold text-foreground" : "text-muted-foreground"
              )}>
                {selectedStore ? selectedStore.name : "แท็กร้านอาหาร (ไม่บังคับ)"}
              </span>
              {selectedStore ? (
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); setSelectedStore(null); }}
                  className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center"
                >
                  <X size={12} className="text-muted-foreground" />
                </motion.div>
              ) : (
                <ChevronDown size={14} className={cn(
                  "text-muted-foreground transition-transform",
                  showStorePicker && "rotate-180"
                )} />
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
                    <input
                      type="text"
                      value={storeSearch}
                      onChange={(e) => setStoreSearch(e.target.value)}
                      placeholder="ค้นหาร้าน..."
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                      autoFocus
                    />
                    {storeSearch && (
                      <button onClick={() => setStoreSearch("")}>
                        <X size={12} className="text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {loadingStores ? (
                      <div className="flex justify-center py-4">
                        <div className="w-5 h-5 border-2 border-score-emerald border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : filteredStores.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-4">ไม่พบร้าน</p>
                    ) : (
                      filteredStores.map((store) => (
                        <motion.button
                          key={store.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedStore(store);
                            setShowStorePicker(false);
                            setStoreSearch("");
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                            selectedStore?.id === store.id
                              ? "bg-score-emerald/10"
                              : "hover:bg-secondary/50"
                          )}
                        >
                          <MapPin size={12} className="text-muted-foreground shrink-0" />
                          <span className="text-sm text-foreground truncate">{store.name}</span>
                        </motion.button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Caption */}
          <div className="rounded-2xl bg-card border border-border/30 shadow-luxury overflow-hidden">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="เขียนอะไรสักหน่อย... 🍜"
              maxLength={500}
              rows={3}
              className="w-full bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none"
            />
            <div className="px-4 pb-2 flex justify-end">
              <span className={cn(
                "text-[10px] font-medium",
                caption.length > 450 ? "text-score-ruby" : "text-muted-foreground/40"
              )}>
                {caption.length}/500
              </span>
            </div>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default CreatePost;
