import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";

interface KaraokeNameProps {
  /** Original name (usually Thai) */
  original: string;
  /** Translated name in user's language (e.g. "Boat Noodles") */
  translated?: string;
  /** Romanized pronunciation (e.g. "Kuay Tiew Ruea") */
  romanized?: string;
  /** Main text class */
  className?: string;
  /** Sub-line class */
  subClassName?: string;
  /** Truncate long names */
  truncate?: boolean;
}

/**
 * Karaoke-style name display:
 * Shows the main name with a subtitle showing translation/romanization.
 * When language = Thai, shows only the original name.
 * When language ≠ Thai, shows translated name as main + original Thai below.
 */
const KaraokeName = ({
  original,
  translated,
  romanized,
  className = "text-[13px] font-semibold text-foreground leading-tight",
  subClassName = "text-[9px] text-muted-foreground leading-tight",
  truncate = true,
}: KaraokeNameProps) => {
  const { language } = useLanguage();

  // If Thai or no translation, show original only
  if (language === "th" || (!translated && !romanized)) {
    return (
      <span className={cn(className, truncate && "truncate block")}>{original}</span>
    );
  }

  const mainName = translated || original;
  const hasSubLine = translated ? original !== translated : false;

  return (
    <span className="flex flex-col">
      <span className={cn(className, truncate && "truncate block")}>{mainName}</span>
      {(hasSubLine || romanized) && (
        <span className={cn(subClassName, truncate && "truncate block", "opacity-60")}>
          {hasSubLine && <span>{original}</span>}
          {hasSubLine && romanized && <span> · </span>}
          {romanized && <span className="italic">{romanized}</span>}
        </span>
      )}
    </span>
  );
};

export default KaraokeName;
