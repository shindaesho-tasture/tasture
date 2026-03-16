export type TrustTier = 1 | 2 | 3 | 4 | 5;

export interface TrustTierInfo {
  tier: TrustTier;
  label: string;
  labelTh: string;
  icon: string;
  description: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

const tierMap: Record<TrustTier, Omit<TrustTierInfo, "tier">> = {
  1: {
    label: "Gold",
    labelTh: "ระดับทอง",
    icon: "🏆",
    description: "50+ รีวิว · ยืนยันแล้ว · มีฟีดแบคเมนู",
    colorClass: "text-gold",
    bgClass: "bg-gold/15",
    borderClass: "border-gold/30",
  },
  2: {
    label: "Silver",
    labelTh: "ระดับเงิน",
    icon: "✅",
    description: "20+ รีวิว · ยืนยันแล้ว",
    colorClass: "text-score-emerald",
    bgClass: "bg-score-emerald/15",
    borderClass: "border-score-emerald/30",
  },
  3: {
    label: "Bronze",
    labelTh: "ระดับทองแดง",
    icon: "🔵",
    description: "<20 รีวิว · ยืนยันแล้ว",
    colorClass: "text-score-slate",
    bgClass: "bg-score-slate/15",
    borderClass: "border-score-slate/30",
  },
  4: {
    label: "Pending",
    labelTh: "รอยืนยัน",
    icon: "⏳",
    description: "ยังไม่ได้ยืนยัน",
    colorClass: "text-score-amber",
    bgClass: "bg-score-amber/15",
    borderClass: "border-score-amber/30",
  },
  5: {
    label: "New",
    labelTh: "ร้านใหม่",
    icon: "🆕",
    description: "ยังไม่มีรีวิว",
    colorClass: "text-muted-foreground",
    bgClass: "bg-secondary",
    borderClass: "border-border",
  },
};

/**
 * Tier 1 (Gold): 50+ store reviews + verified + has menu reviews
 * Tier 2 (Silver): 20+ store reviews + verified
 * Tier 3 (Bronze): <20 store reviews + verified
 * Tier 4 (Pending): unverified but has reviews
 * Tier 5 (New): unverified, no reviews
 */
export function getTrustTier(
  reviewCount: number,
  verified: boolean,
  menuReviewCount: number = 0,
): TrustTier {
  if (!verified) {
    return reviewCount === 0 ? 5 : 4;
  }
  if (reviewCount >= 50 && menuReviewCount > 0) return 1;
  if (reviewCount >= 20) return 2;
  return 3;
}

/**
 * Menu item tier (scaled down from store tier):
 * Tier 1 (Gold): 10+ menu reviews + has DNA feedback
 * Tier 2 (Silver): 5+ menu reviews
 * Tier 3 (Bronze): <5 menu reviews (but has some)
 * Tier 5 (New): no reviews at all
 */
export function getMenuTrustTier(
  menuReviewCount: number,
  dnaCount: number,
): TrustTier {
  if (menuReviewCount === 0 && dnaCount === 0) return 5;
  if (menuReviewCount >= 10 && dnaCount > 0) return 1;
  if (menuReviewCount >= 5) return 2;
  if (menuReviewCount > 0 || dnaCount > 0) return 3;
  return 5;
}

export function getTrustTierInfo(tier: TrustTier): TrustTierInfo {
  return { tier, ...tierMap[tier] };
}
