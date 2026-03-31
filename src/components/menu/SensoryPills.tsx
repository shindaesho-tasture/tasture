import { classifyTags, CATEGORY_CONFIG, type SensoryCategory } from "@/lib/sensory-classifier";
import { useTagTranslations } from "@/hooks/use-tag-translations";

interface SensoryPillsProps {
  textures: string[];
}

/** Renders sensory tags grouped by category with distinct icons, translated to current language */
const SensoryPills = ({ textures }: SensoryPillsProps) => {
  if (!textures.length) return null;

  const { translateTag } = useTagTranslations(textures);
  const classified = classifyTags(textures);

  // Group by category, preserving order of first appearance
  const groups: { category: SensoryCategory; labels: string[] }[] = [];
  const seen = new Set<SensoryCategory>();

  for (const tag of classified) {
    if (!seen.has(tag.category)) {
      seen.add(tag.category);
      groups.push({ category: tag.category, labels: [] });
    }
    groups.find((g) => g.category === tag.category)!.labels.push(tag.label);
  }

  return (
    <div className="flex flex-wrap gap-1">
      {groups.map((group) => {
        const config = CATEGORY_CONFIG[group.category];
        return group.labels.map((label) => (
          <span
            key={`${group.category}-${label}`}
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-medium text-muted-foreground ${config.color}`}
          >
            <span className="text-[8px]">{config.icon}</span>
            {translateTag(label)}
          </span>
        ));
      })}
    </div>
  );
};

export default SensoryPills;
