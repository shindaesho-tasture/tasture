import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, Star, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";
import { categories, getScoreTier, scoreTiers, type ScoreTier } from "@/lib/categories";
import { getIntensityOpacity } from "@/lib/scoring";
import { useTagTranslations } from "@/hooks/use-tag-translations";
import { cn } from "@/lib/utils";

interface StoreDetailsTabProps {
  storeId: string;
  storeName: string;
  categoryId?: string | null;
}

interface ReviewSummary {
  metric_id: string;
  avg_score: number;
  count: number;
}

const tierColors: Record<ScoreTier, string> = {
  emerald: "bg-score-emerald",
  mint: "bg-score-mint",
  slate: "bg-score-slate",
  amber: "bg-score-amber",
  ruby: "bg-score-ruby",
};

const tierTextColors: Record<ScoreTier, string> = {
  emerald: "text-score-emerald",
  mint: "text-score-mint",
  slate: "text-score-slate",
  amber: "text-score-amber",
  ruby: "text-score-ruby",
};

const StoreDetailsTab = ({ storeId, storeName, categoryId }: StoreDetailsTabProps) => {
  const { language } = useLanguage();
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary[]>([]);
  const [totalReviewers, setTotalReviewers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [storeInfo, setStoreInfo] = useState<{
    description?: string | null;
    opening_hours?: string | null;
    phone?: string | null;
    line_id?: string | null;
    address?: string | null;
    pin_lat?: number | null;
    pin_lng?: number | null;
    cover_photo?: string | null;
    logo_url?: string | null;
  }>({});

  // Find matching category for metrics
  const storeCategory = useMemo(() => {
    if (categoryId) {
      return categories.find((c) => c.id === categoryId);
    }
    return categories[0]; // default to everyday
  }, [categoryId]);

  // Collect translatable texts
  const translatableTexts = useMemo(() => {
    const texts: string[] = [];
    if (storeCategory) {
      texts.push(storeCategory.labelTh, storeCategory.description);
      storeCategory.metrics.forEach((m) => {
        texts.push(m.label, ...m.options);
        if (m.smartGate) {
          texts.push(m.smartGate.question);
          if (m.smartGate.yesLabel) texts.push(m.smartGate.yesLabel);
          if (m.smartGate.noLabel) texts.push(m.smartGate.noLabel);
          m.smartGate.subMetrics.forEach((sm) => {
            texts.push(sm.label, ...sm.options);
          });
        }
      });
    }
    scoreTiers.forEach((st) => texts.push(st.label));
    return texts;
  }, [storeCategory]);

  const { translateTag } = useTagTranslations(translatableTexts);

  useEffect(() => {
    fetchReviews();
    fetchStoreInfo();
  }, [storeId]);

  const fetchStoreInfo = async () => {
    const { data } = await supabase
      .from("stores")
      .select("description, opening_hours, phone, line_id, address, pin_lat, pin_lng, cover_photo, logo_url")
      .eq("id", storeId)
      .single();
    if (data) setStoreInfo(data as any);
  };

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const { data: reviews } = await supabase
        .from("reviews")
        .select("metric_id, score, user_id")
        .eq("store_id", storeId);

      if (reviews && reviews.length > 0) {
        // Count unique reviewers
        const uniqueUsers = new Set(reviews.map((r) => r.user_id));
        setTotalReviewers(uniqueUsers.size);

        // Aggregate by metric
        const metricMap = new Map<string, { total: number; count: number }>();
        reviews.forEach((r) => {
          if (!metricMap.has(r.metric_id)) metricMap.set(r.metric_id, { total: 0, count: 0 });
          const entry = metricMap.get(r.metric_id)!;
          entry.total += r.score;
          entry.count++;
        });

        const summary: ReviewSummary[] = [];
        metricMap.forEach((val, key) => {
          summary.push({ metric_id: key, avg_score: val.total / val.count, count: val.count });
        });
        setReviewSummary(summary);
      }
    } catch (e) {
      console.error("fetchReviews error:", e);
    } finally {
      setLoading(false);
    }
  };

  // Get overall score
  const overallScore = useMemo(() => {
    if (reviewSummary.length === 0) return null;
    const total = reviewSummary.reduce((s, r) => s + r.avg_score, 0);
    return total / reviewSummary.length;
  }, [reviewSummary]);

  const overallTier = overallScore != null ? getScoreTier(overallScore) : null;

  // Find metric info from category
  const getMetricInfo = (metricId: string) => {
    if (!storeCategory) return null;
    for (const m of storeCategory.metrics) {
      if (m.id === metricId) return m;
      if (m.smartGate) {
        for (const sm of m.smartGate.subMetrics) {
          if (sm.id === metricId) return sm;
        }
      }
    }
    return null;
  };

  // Get label for a score value
  const getScoreInfo = (score: number) => {
    const tier = getScoreTier(score);
    const st = scoreTiers.find((s) => s.value === Math.round(score));
    return { tier, label: st ? translateTag(st.label) : "" };
  };

  // Sensory tag legend data
  const sensoryLegend = [
    { icon: "🫧", label: "Texture", descTh: "เนื้อสัมผัส", color: "bg-secondary" },
    { icon: "👃", label: "Aroma", descTh: "กลิ่น", color: "bg-amber-100 dark:bg-amber-900/30" },
    { icon: "👅", label: "Mouthfeel", descTh: "ความรู้สึกในปาก", color: "bg-rose-100 dark:bg-rose-900/30" },
  ];

  return (
    <div className="px-4 pt-4 pb-8 space-y-6">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
          <span className="text-xs text-muted-foreground">{t("order.loadingMenu", language)}</span>
        </div>
      ) : (
        <>
          {/* Store Header with Logo */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-14 h-14 rounded-2xl bg-secondary border border-border/40 overflow-hidden flex items-center justify-center flex-shrink-0">
              {storeInfo.logo_url ? (
                <img src={storeInfo.logo_url} alt={storeName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-muted-foreground">{storeName[0]}</span>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground truncate">{storeName}</h2>
              {storeCategory && (
                <p className="text-xs text-muted-foreground">{translateTag(storeCategory.labelTh)}</p>
              )}
            </div>
          </motion.div>

          {/* Cover Photo */}
          {storeInfo.cover_photo && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl overflow-hidden border border-border/40 -mx-0"
            >
              <img
                src={storeInfo.cover_photo}
                alt={`${storeName} cover`}
                className="w-full h-48 object-cover"
                loading="lazy"
              />
            </motion.div>
          )}

          {/* Store Info */}
          {(storeInfo.description || storeInfo.opening_hours || storeInfo.phone || storeInfo.line_id || storeInfo.address) && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl border border-border/40 overflow-hidden"
            >
              {storeInfo.description && (
                <div className="px-4 py-3 border-b border-border/20">
                  <p className="text-sm text-foreground leading-relaxed">{storeInfo.description}</p>
                </div>
              )}
              <div className="divide-y divide-border/20">
                {storeInfo.opening_hours && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Clock size={16} className="text-score-emerald shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium">เวลาเปิด-ปิด</p>
                      <p className="text-sm text-foreground font-medium">{storeInfo.opening_hours}</p>
                    </div>
                  </div>
                )}
                {storeInfo.address && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <MapPin size={16} className="text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium">ที่อยู่</p>
                      <p className="text-sm text-foreground">{storeInfo.address}</p>
                    </div>
                  </div>
                )}
                {(storeInfo.phone || storeInfo.line_id) && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-base shrink-0">📞</span>
                    <div className="flex flex-wrap gap-3">
                      {storeInfo.phone && (
                        <a href={`tel:${storeInfo.phone}`} className="text-sm text-primary font-medium">{storeInfo.phone}</a>
                      )}
                      {storeInfo.line_id && (
                        <span className="text-sm text-score-emerald font-medium">Line: {storeInfo.line_id}</span>
                      )}
                    </div>
                  </div>
                )}
                {storeInfo.pin_lat && storeInfo.pin_lng && (
                  <div className="p-3 border-t border-border/20">
                    <p className="text-[10px] text-muted-foreground font-medium mb-2">📍 แผนที่</p>
                    <div className="rounded-xl overflow-hidden border border-border/30">
                      <iframe
                        title="Store location"
                        width="100%"
                        height="200"
                        style={{ border: 0 }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyCMtKoObZNxS68VfSbMsbyP9KKruLU346w&q=${storeInfo.pin_lat},${storeInfo.pin_lng}&zoom=16`}
                      />
                    </div>
                    <motion.a
                      whileTap={{ scale: 0.97 }}
                      href={`https://www.google.com/maps/dir/?api=1&destination=${storeInfo.pin_lat},${storeInfo.pin_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
                    >
                      <MapPin size={14} />
                      {language === "th" ? "นำทางไปร้านนี้" : "Navigate to this store"}
                    </motion.a>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {/* Overall Score Card */}
          {overallScore != null && overallTier && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl border border-border/40 p-5"
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "w-16 h-16 rounded-2xl flex flex-col items-center justify-center",
                    tierColors[overallTier],
                  )}
                  style={{ opacity: getIntensityOpacity(totalReviewers) }}
                >
                  <span className="text-xl font-bold text-white">
                    {overallScore > 0 ? "+" : ""}{overallScore.toFixed(1)}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-foreground">
                    {t("storeDetail.overallScore", language)}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Users size={12} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {totalReviewers} {t("storeDetail.reviewers", language)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Feedback Tags */}
          {reviewSummary.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">
                📊 {t("storeDetail.feedbackSummary", language)}
              </h3>
              <div className="space-y-2">
                {reviewSummary
                  .sort((a, b) => b.count - a.count)
                  .map((rs) => {
                    const metric = getMetricInfo(rs.metric_id);
                    const info = getScoreInfo(rs.avg_score);
                    const opacity = getIntensityOpacity(rs.count);

                    return (
                      <div
                        key={rs.metric_id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30"
                      >
                        <span className="text-xl flex-shrink-0">{metric?.icon || "📋"}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground">
                            {metric ? translateTag(metric.label) : rs.metric_id}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div
                              className={cn(
                                "h-1.5 rounded-full flex-1",
                                tierColors[info.tier],
                              )}
                              style={{
                                opacity,
                                width: `${Math.max(20, ((rs.avg_score + 2) / 4) * 100)}%`,
                                maxWidth: "100%",
                              }}
                            />
                            <span className={cn("text-[10px] font-bold", tierTextColors[info.tier])}>
                              {info.label}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {rs.count} {t("feedback.persons", language)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          )}

          {/* No reviews yet */}
          {reviewSummary.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <span className="text-4xl">📝</span>
              <p className="text-sm text-muted-foreground">{t("storeDetail.noReviews", language)}</p>
            </div>
          )}

          {/* Sensory Tag Legend */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">
              🧬 {t("storeDetail.sensoryLegend", language)}
            </h3>
            <div className="space-y-2">
              {sensoryLegend.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/30"
                >
                  <span className="text-lg">{item.icon}</span>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {translateTag(item.descTh)}
                    </span>
                  </div>
                  <div className={cn("w-8 h-2 rounded-full", item.color)} />
                </div>
              ))}
            </div>
          </motion.div>

          {/* Score Legend */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">
              🎯 {t("storeDetail.scoreLegend", language)}
            </h3>
            <div className="flex flex-wrap gap-2">
              {scoreTiers.map((st) => {
                const tier = st.tier;
                return (
                  <div
                    key={st.value}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border/30"
                  >
                    <div className={cn("w-3 h-3 rounded-full", tierColors[tier])} />
                    <span className="text-xs font-medium text-foreground">
                      {st.shortLabel}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {translateTag(st.label)}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Category Info */}
          {storeCategory && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card rounded-2xl border border-border/40 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{storeCategory.icon}</span>
                <span className="text-sm font-bold text-foreground">
                  {translateTag(storeCategory.labelTh)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {translateTag(storeCategory.description)}
              </p>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
};

export default StoreDetailsTab;
