export type PopularityTier = 1 | 2 | 3 | 4 | 5;

export interface PopularityTierInfo {
  tier: PopularityTier;
  label: string;
  borderClass: string;
  glowClass: string;
}

export function getPopularityTier(reviewCount: number): PopularityTier {
  if (reviewCount > 500) return 5;
  if (reviewCount > 200) return 4;
  if (reviewCount > 50) return 3;
  if (reviewCount > 10) return 2;
  return 1;
}

export function getPopularityTierInfo(tier: PopularityTier): PopularityTierInfo {
  switch (tier) {
    case 5:
      return {
        tier: 5,
        label: "Sovereign Legend",
        borderClass: "border-l-[8px] border-l-score-emerald",
        glowClass: "animate-sovereign-pulse",
      };
    case 4:
      return {
        tier: 4,
        label: "Tier 4 Elite",
        borderClass: "border-l-[6px] border-l-score-emerald",
        glowClass: "shadow-[0_0_12px_2px_hsl(var(--score-emerald)/0.2)]",
      };
    case 3:
      return {
        tier: 3,
        label: "Tier 3 Status",
        borderClass: "border-l-[4px] border-l-score-emerald",
        glowClass: "shadow-[0_2px_12px_hsl(var(--shadow-card))]",
      };
    case 2:
      return {
        tier: 2,
        label: "Tier 2 Status",
        borderClass: "border-l-[2px] border-l-score-emerald",
        glowClass: "",
      };
    case 1:
    default:
      return {
        tier: 1,
        label: "",
        borderClass: "",
        glowClass: "",
      };
  }
}
