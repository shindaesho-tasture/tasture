import { getTrustTierInfo, type TrustTier } from "@/lib/trust-tiers";

interface TrustTierBadgeProps {
  tier: TrustTier;
  compact?: boolean;
}

const TrustTierBadge = ({ tier, compact = false }: TrustTierBadgeProps) => {
  const info = getTrustTierInfo(tier);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${info.bgClass} ${info.colorClass} ${info.borderClass}`}
      >
        {info.icon} {info.labelTh}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border ${info.bgClass} ${info.colorClass} ${info.borderClass}`}
    >
      <span>{info.icon}</span>
      <div className="flex flex-col leading-tight">
        <span className="font-semibold">{info.labelTh}</span>
        <span className="text-[9px] opacity-70">{info.description}</span>
      </div>
    </div>
  );
};

export default TrustTierBadge;
