import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/language-context";

/**
 * Hook to fetch and cache tag translations for the current language.
 * Automatically triggers AI translation for missing tags via edge function.
 */
export function useTagTranslations(tags: string[]) {
  const { language } = useLanguage();
  const [translationMap, setTranslationMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (language === "th" || tags.length === 0) {
      setTranslationMap(new Map());
      return;
    }

    let cancelled = false;

    const fetchTranslations = async () => {
      setLoading(true);

      // 1. Try to get existing translations from DB
      const { data: existing } = await supabase
        .from("tag_translations")
        .select("tag_text, translated_text")
        .eq("language", language)
        .in("tag_text", tags);

      const map = new Map<string, string>();
      (existing || []).forEach((row: any) => {
        map.set(row.tag_text, row.translated_text);
      });

      // 2. Find missing tags
      const missingTags = tags.filter((t) => !map.has(t));

      if (missingTags.length > 0) {
        // 3. Call edge function to translate missing tags
        try {
          const { data } = await supabase.functions.invoke("translate-tags", {
            body: { tags: missingTags, target_languages: [language] },
          });
          if (data?.translations) {
            data.translations.forEach((t: any) => {
              if (t.language === language) {
                map.set(t.tag_text, t.translated_text);
              }
            });
          }
        } catch (e) {
          console.error("Tag translation error:", e);
        }
      }

      if (!cancelled) {
        setTranslationMap(map);
        setLoading(false);
      }
    };

    fetchTranslations();
    return () => { cancelled = true; };
  }, [language, tags.join(",")]);

  const translateTag = useCallback(
    (tag: string) => translationMap.get(tag) || tag,
    [translationMap]
  );

  return { translateTag, translationMap, loading };
}
