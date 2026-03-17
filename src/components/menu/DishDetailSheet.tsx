import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { getScoreTier, type ScoreTier } from "@/lib/categories";
import { getIntensityOpacity } from "@/lib/scoring";
import { supabase } from "@/integrations/supabase/client";
import BalanceSpiderChart from "./BalanceSpiderChart";
import type { SensoryAxis } from "@/lib/sensory-types";
import { cn } from "@/lib/utils";

interface DnaTag {
  component_icon: string;
  component_name: string;
  selected_tag: string;
  selected_score: number;
  count: number;
}

interface DishDetailSheetProps {
  open: boolean;
  onClose: () => void;
  menuItemId: string;
  dishName: string;
  price: number;
  priceSpecial?: number | null;
  imageUrl?: string;
  dnaTags: DnaTag[];
  totalReviews: number;
}

/** Compute a simple emerald seal: avg score ≥ 1.0 and reviews ≥ 5 */
const hasEmeraldSeal = (tags: DnaTag[], reviews: number) => {
  if (reviews < 5 || tags.length === 0) return false;
  const avg = tags.reduce((s, t) => s + t.selected_score, 0) / tags.length;
  return avg >= 1.0;
};
/** Photo posted by users */
interface UserPhoto {
  id: string;
  image_url: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  post_id: string;
}

const DishDetailSheet = ({
  open,
  onClose,
  menuItemId,
  dishName,
  price,
  priceSpecial,
  imageUrl,
  dnaTags,
  totalReviews,
}: DishDetailSheetProps) => {
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [sensoryAxes, setSensoryAxes] = useState<SensoryAxis[]>([]);
  const [sensoryValues, setSensoryValues] = useState<Record<string, number>>({});
  const [userPhotos, setUserPhotos] = useState<UserPhoto[]>([]);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const emerald = hasEmeraldSeal(dnaTags, totalReviews);

  // Fetch AI descriptions and user photos when opening
  useEffect(() => {
    if (!open) return;
    if (dnaTags.length > 0) fetchDescriptions();
    fetchUserPhotos();
    setActivePhotoIdx(0);
  }, [open, menuItemId]);

  const fetchUserPhotos = async () => {
    try {
      // Get menu_review ids for this menu item
      const { data: reviews } = await supabase
        .from("menu_reviews")
        .select("id")
        .eq("menu_item_id", menuItemId);

      if (!reviews || reviews.length === 0) { setUserPhotos([]); return; }

      const reviewIds = reviews.map((r) => r.id);

      // Get post_images linked to these reviews
      const { data: images } = await supabase
        .from("post_images")
        .select("id, image_url, post_id, menu_review_id, created_at")
        .in("menu_review_id", reviewIds)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!images || images.length === 0) { setUserPhotos([]); return; }

      // Get post user_ids
      const postIds = [...new Set(images.map((i) => i.post_id))];
      const { data: posts } = await supabase
        .from("posts")
        .select("id, user_id")
        .in("id", postIds);

      const postUserMap = new Map<string, string>();
      (posts || []).forEach((p) => postUserMap.set(p.id, p.user_id));

      // Get profiles
      const userIds = [...new Set((posts || []).map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
      (profiles || []).forEach((p) => profileMap.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url }));

      setUserPhotos(images.map((img) => {
        const userId = postUserMap.get(img.post_id) || "";
        const profile = profileMap.get(userId);
        return {
          id: img.id,
          image_url: img.image_url,
          user_id: userId,
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null,
          created_at: img.created_at,
          post_id: img.post_id,
        };
      }));
    } catch (e) {
      console.error("fetchUserPhotos error:", e);
      setUserPhotos([]);
    }
  };

  const fetchDescriptions = async () => {
    setLoadingDesc(true);
    try {
      const tagsPayload = dnaTags.map((t) => ({
        ingredient: t.component_name,
        icon: t.component_icon,
        tag: t.selected_tag,
        score: t.selected_score,
      }));

      const { data, error } = await supabase.functions.invoke("describe-dish", {
        body: { dish_name: dishName, tags: tagsPayload },
      });

      if (!error && data?.descriptions) {
        const descMap: Record<string, string> = {};
        (data.descriptions as Array<{ ingredient: string; description: string }>).forEach(
          (d) => (descMap[d.ingredient] = d.description)
        );
        setDescriptions(descMap);
      }
    } catch (e) {
      console.error("describe-dish error:", e);
    } finally {
      setLoadingDesc(false);
    }
  };

  // Build pseudo spider chart from DNA scores
  useEffect(() => {
    if (dnaTags.length === 0) return;
    // Group by component, compute average score
    const compMap = new Map<string, { icon: string; scores: number[] }>();
    dnaTags.forEach((t) => {
      if (!compMap.has(t.component_name)) {
        compMap.set(t.component_name, { icon: t.component_icon, scores: [] });
      }
      compMap.get(t.component_name)!.scores.push(t.selected_score);
    });

    const axes: SensoryAxis[] = [];
    const values: Record<string, number> = {};
    compMap.forEach((val, name) => {
      const avg = val.scores.reduce((s, v) => s + v, 0) / val.scores.length;
      // Map -2..+2 → 1..5
      const level = Math.round(((avg + 2) / 4) * 4) + 1;
      axes.push({
        name,
        icon: val.icon,
        labels: ["", "", "", "", ""] as [string, string, string, string, string],
      });
      values[name] = Math.max(1, Math.min(5, level));
    });

    setSensoryAxes(axes);
    setSensoryValues(values);
  }, [dnaTags]);

  // Consistency placeholder based on score variance
  const getConsistency = () => {
    if (dnaTags.length < 3) return null;
    const scores = dnaTags.map((t) => t.selected_score);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const variance = scores.reduce((s, v) => s + (v - avg) ** 2, 0) / scores.length;
    return variance < 1.5 ? "เสน่ห์คงเดิม" : "รสชาติมีความแปรปรวน";
  };

  const consistency = getConsistency();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-foreground/40"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-luxury max-h-[88vh] overflow-hidden flex flex-col"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted" />
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 pb-8">
              {/* Hero Image */}
              <div className="relative w-full aspect-[16/9] bg-secondary overflow-hidden">
                {imageUrl ? (
                  <img src={imageUrl} alt={dishName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-secondary to-muted">
                    🍽️
                  </div>
                )}

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full glass-effect glass-border flex items-center justify-center"
                >
                  <X size={16} strokeWidth={2} className="text-foreground" />
                </button>

                {/* Emerald seal */}
                {emerald && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-score-emerald text-white text-[11px] font-bold shadow-lg">
                    💎 มรกตรับรอง
                  </div>
                )}
              </div>

              {/* IG-style User Photos Gallery */}
              {userPhotos.length > 0 && (
                <div className="px-5 pt-3 pb-2">
                  <h3 className="text-xs font-semibold text-foreground mb-2.5 uppercase tracking-wider">
                    📸 รูปจากผู้ใช้ ({userPhotos.length})
                  </h3>
                  {/* Main photo display */}
                  <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-secondary">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={userPhotos[activePhotoIdx]?.id}
                        src={userPhotos[activePhotoIdx]?.image_url}
                        alt="User photo"
                        className="w-full h-full object-cover"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      />
                    </AnimatePresence>

                    {/* User info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 px-3 py-2.5 bg-gradient-to-t from-black/60 to-transparent">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-muted overflow-hidden border-2 border-white/30 flex-shrink-0">
                          {userPhotos[activePhotoIdx]?.avatar_url ? (
                            <img src={userPhotos[activePhotoIdx].avatar_url!} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px]">👤</div>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-white truncate">
                          {userPhotos[activePhotoIdx]?.display_name || "ผู้ใช้"}
                        </span>
                      </div>
                    </div>

                    {/* Nav arrows */}
                    {userPhotos.length > 1 && (
                      <>
                        {activePhotoIdx > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setActivePhotoIdx((i) => i - 1); }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center"
                          >
                            <ChevronLeft size={14} className="text-foreground" />
                          </button>
                        )}
                        {activePhotoIdx < userPhotos.length - 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setActivePhotoIdx((i) => i + 1); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center"
                          >
                            <ChevronRight size={14} className="text-foreground" />
                          </button>
                        )}
                      </>
                    )}

                    {/* Dots indicator */}
                    {userPhotos.length > 1 && (
                      <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-foreground/50 backdrop-blur-sm">
                        <span className="text-[10px] font-semibold text-white">
                          {activePhotoIdx + 1}/{userPhotos.length}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Thumbnail strip */}
                  {userPhotos.length > 1 && (
                    <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-hide pb-1">
                      {userPhotos.map((photo, idx) => (
                        <button
                          key={photo.id}
                          onClick={() => setActivePhotoIdx(idx)}
                          className={cn(
                            "w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all",
                            idx === activePhotoIdx
                              ? "border-score-emerald shadow-[0_0_8px_hsla(163,78%,20%,0.3)]"
                              : "border-transparent opacity-60"
                          )}
                        >
                          <img src={photo.image_url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="px-5 pt-4 pb-3">
                <h2 className="text-xl font-bold text-foreground">{dishName}</h2>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-base font-semibold text-score-emerald">฿{price}</span>
                  {priceSpecial != null && (
                    <span className="text-sm font-light text-muted-foreground">
                      พิเศษ ฿{priceSpecial}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {totalReviews} รีวิว
                  </span>
                </div>
              </div>

              {/* Balance Spider Chart */}
              {sensoryAxes.length >= 3 && (
                <div className="px-5 py-3">
                  <h3 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">
                    ⚖️ ระดับความสมดุล
                  </h3>
                  <BalanceSpiderChart axes={sensoryAxes} values={sensoryValues} />
                </div>
              )}

              {/* Sensory Explainer */}
              {dnaTags.length > 0 && (
                <div className="px-5 py-3">
                  <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">
                    📖 คัมภีร์รสชาติ
                  </h3>
                  <div className="space-y-3">
                    {dnaTags.map((tag) => {
                      const tier = getScoreTier(tag.selected_score);
                      const opacity = getIntensityOpacity(tag.count);
                      const tierHsl: Record<ScoreTier, string> = {
                        emerald: "163,78%,20%",
                        mint: "105,24%,70%",
                        slate: "215,16%,47%",
                        amber: "32,95%,44%",
                        ruby: "0,68%,35%",
                      };
                      const hsl = tierHsl[tier];

                      return (
                        <div
                          key={`${tag.component_name}-${tag.selected_tag}`}
                          className="flex items-start gap-3 p-3 rounded-xl bg-surface border border-border/30"
                        >
                          <span className="text-2xl flex-shrink-0 mt-0.5">{tag.component_icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                {tag.component_name}
                              </span>
                              <span
                                className="inline-flex items-center px-2 py-[2px] rounded-full text-[10px] font-bold text-white leading-none"
                                style={{ backgroundColor: `hsla(${hsl},${opacity})` }}
                              >
                                {tag.selected_tag}
                                {tag.count > 1 && (
                                  <span className="ml-1 opacity-70">×{tag.count}</span>
                                )}
                              </span>
                            </div>

                            {/* AI description */}
                            {loadingDesc ? (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <Loader2 size={10} className="animate-spin text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground">
                                  กำลังเขียนคำบรรยาย...
                                </span>
                              </div>
                            ) : descriptions[tag.component_name] ? (
                              <p className="text-[12px] text-muted-foreground leading-relaxed mt-1.5 italic">
                                "{descriptions[tag.component_name]}"
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Consistency */}
              {consistency && (
                <div className="px-5 py-3">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-surface border border-border/30">
                    <span className="text-lg">
                      {consistency === "เสน่ห์คงเดิม" ? "✨" : "🎲"}
                    </span>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        ความคงที่
                      </span>
                      <p className="text-sm font-medium text-foreground">{consistency}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DishDetailSheet;
