import { supabase } from "@/integrations/supabase/client";

const ALL_TARGET_LANGUAGES = ["en", "ja", "zh", "ko"];

/**
 * Pre-translate tags into all 5 languages immediately after feedback is saved.
 * This ensures users see translations instantly without waiting for lazy loading.
 * Runs in the background — does not block the UI.
 */
export async function preTranslateTags(tags: string[]) {
  if (!tags || tags.length === 0) return;

  // Deduplicate and filter empty
  const uniqueTags = [...new Set(tags.filter((t) => t && t.trim()))];
  if (uniqueTags.length === 0) return;

  try {
    await supabase.functions.invoke("translate-tags", {
      body: { tags: uniqueTags, target_languages: ALL_TARGET_LANGUAGES },
    });
  } catch (e) {
    // Silent fail — pre-translation is best-effort
    console.warn("Pre-translate failed:", e);
  }
}

/**
 * Extract all translatable texts from DNA rows and trigger pre-translation.
 */
export function preTranslateDnaTags(
  dnaRows: { component_name: string; selected_tag: string }[]
) {
  const tags = new Set<string>();
  dnaRows.forEach((r) => {
    tags.add(r.component_name);
    tags.add(r.selected_tag);
  });
  preTranslateTags(Array.from(tags));
}

/**
 * Pre-translate store-related data: name, category label, metric labels.
 */
export function preTranslateStoreData(data: {
  storeName?: string;
  categoryLabel?: string;
  metricLabels?: string[];
  menuCategories?: string[];
  menuNames?: string[];
}) {
  const tags = new Set<string>();
  if (data.storeName) tags.add(data.storeName);
  if (data.categoryLabel) tags.add(data.categoryLabel);
  data.metricLabels?.forEach((l) => tags.add(l));
  data.menuCategories?.forEach((c) => tags.add(c));
  data.menuNames?.forEach((n) => tags.add(n));
  preTranslateTags(Array.from(tags));
}

/**
 * Pre-translate sensory axis names and labels.
 */
export function preTranslateSensoryAxes(
  axes: { name: string; labels: string[] }[]
) {
  const tags = new Set<string>();
  axes.forEach((a) => {
    tags.add(a.name);
    a.labels.forEach((l) => tags.add(l));
  });
  preTranslateTags(Array.from(tags));
}
